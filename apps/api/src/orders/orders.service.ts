import { Injectable, Logger } from "@nestjs/common";
import type { OrderSettings, Prisma } from "@prisma/client";
import { getApiUrl } from "@boutik/config";
import {
  API_ERROR_CODES,
  canTransitionOrder,
  formatOrderNumber,
  orderTotals,
  sitePublicStatus,
  tenantSlugFromHost,
} from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { assertOfferingCapability } from "../catalog/effective-capabilities";
import { NotificationService } from "../auth/notification.service";
import { ModulesService, SMS_MODULE_SLUG } from "../modules/modules.service";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantAccessService } from "../professionals/tenant-access.service";
import { workspaceWithRelations } from "../professionals/workspace.presenter";
import { WalletService } from "../wallet/wallet.service";
import type {
  CancelOrderDto,
  CreateOrderDto,
  ListOrdersQueryDto,
  OrderStatusDto,
  QuoteOrderDto,
  UpdateOrderSettingsDto,
} from "./dto/order.dto";
import { orderInclude, presentOrder, presentPublicSettings, presentQuote, presentSettings } from "./order.presenter";
import { PaydunyaService } from "./paydunya.service";

type PublicQuery = { slug?: string; host?: string };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly notifications: NotificationService,
    private readonly proNotifications: ProNotificationsService,
    private readonly paydunya: PaydunyaService,
    private readonly wallet: WalletService,
    private readonly modules: ModulesService,
  ) {}

  async getSettings(userId: string, tenantId: string) {
    const tenant = await this.requireOrders(userId, tenantId);
    return presentSettings(await this.ensureSettings(tenant.id));
  }

  async updateSettings(userId: string, tenantId: string, input: UpdateOrderSettingsDto) {
    const tenant = await this.requireOrders(userId, tenantId, { mutate: true });
    const current = await this.ensureSettings(tenant.id);
    const pickupEnabled = input.pickupEnabled ?? current.pickupEnabled;
    const deliveryEnabled = input.deliveryEnabled ?? current.deliveryEnabled;
    if (!pickupEnabled && !deliveryEnabled) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Activez au moins un mode de retrait ou de livraison");
    }
    return presentSettings(
      await this.prisma.orderSettings.update({
        where: { tenantId: tenant.id },
        data: input,
      }),
    );
  }

  async list(userId: string, tenantId: string, query: ListOrdersQueryDto) {
    const tenant = await this.requireOrders(userId, tenantId);
    const orders = await this.prisma.order.findMany({
      where: { tenantId: tenant.id, status: query.status, fulfillment: query.fulfillment },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    return orders.map(presentOrder);
  }

  async get(userId: string, tenantId: string, orderId: string) {
    const tenant = await this.requireOrders(userId, tenantId);
    return presentOrder(await this.requireOrder(tenant.id, orderId));
  }

  async setStatus(userId: string, tenantId: string, orderId: string, input: OrderStatusDto, reason?: string) {
    const tenant = await this.requireOrders(userId, tenantId, { mutate: true });
    const current = await this.requireOrder(tenant.id, orderId);
    if (current.status === input.status) {
      return presentOrder(current);
    }
    if (!canTransitionOrder(current.status, input.status, current.fulfillment)) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Ce changement de statut n'est pas autorisé", {
        from: current.status,
        to: input.status,
        fulfillment: current.fulfillment,
      });
    }
    const updated = await this.prisma.order.update({
      where: { id: current.id },
      data: {
        status: input.status,
        cancelledAt: input.status === "CANCELLED" ? new Date() : current.cancelledAt,
        cancelReason: input.status === "CANCELLED" ? (reason ?? current.cancelReason) : current.cancelReason,
        events: {
          create: {
            type: "STATUS",
            fromStatus: current.status,
            toStatus: input.status,
            message: input.status === "CANCELLED" ? reason : undefined,
          },
        },
      },
      include: orderInclude,
    });

    if (input.status === "DELIVERED" || input.status === "PICKED_UP") {
      const availableAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await this.wallet.creditOrderSale({
        id: updated.id,
        tenantId: updated.tenantId,
        totalXof: updated.totalXof,
        paidAt: availableAt,
      });
    }

    const settings = await this.ensureSettings(tenant.id);
    await this.notifyOrder(updated, settings, "status");
    return presentOrder(await this.requireOrder(tenant.id, updated.id));
  }

  async cancel(userId: string, tenantId: string, orderId: string, input: CancelOrderDto) {
    return this.setStatus(userId, tenantId, orderId, { status: "CANCELLED" }, input.reason);
  }

  /**
   * Rembourse une commande annulée.
   * - Payée SoftPay (PAID + PAYDUNYA) → cashout PayDunya vers le client
   * - COD / non encaissée → marquage local « remboursée » (aucun cashout)
   */
  async refund(userId: string, tenantId: string, orderId: string) {
    const tenant = await this.requireOrders(userId, tenantId, { mutate: true });
    const order = await this.requireOrder(tenant.id, orderId);

    if (order.status !== "CANCELLED") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Seule une commande annulée peut être remboursée");
    }
    if (order.paymentStatus === "CANCELLED") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Cette commande est déjà remboursée");
    }

    const onlinePaid = order.paymentStatus === "PAID" && order.paymentProvider === "PAYDUNYA";

    if (onlinePaid) {
      this.paydunya.assertEnabled();
      const callbackUrl = `${getApiUrl().replace(/\/$/, "")}/api/storefront/payments/paydunya/cashout-ipn`;
      const cashout = await this.paydunya.cashout({
        customerPhone: order.customerPhone,
        amountXof: order.totalXof,
        paymentMethod: order.paymentMethod,
        callbackUrl,
      });

      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "CANCELLED",
          events: {
            create: {
              type: "PAYMENT",
              message: `Remboursement cashout PayDunya (${cashout.withdrawMode}) · ${cashout.message} · ${cashout.disburseToken}`,
            },
          },
        },
        include: orderInclude,
      });

      await this.wallet.debitOrderRefund(
        {
          id: updated.id,
          tenantId: updated.tenantId,
          totalXof: updated.totalXof,
        },
        `Cashout ${cashout.disburseToken}`,
      );

      return presentOrder(updated);
    }

    // COD / paiement non encaissé : clôture locale sans PUSH PayDunya
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "CANCELLED",
        events: {
          create: {
            type: "PAYMENT",
            message:
              order.paymentProvider === "COD" || order.paymentMethod === "cod"
                ? "Commande COD annulée — marquée remboursée (aucun encaissement en ligne)"
                : "Paiement marqué remboursé (aucun encaissement SoftPay confirmé)",
          },
        },
      },
      include: orderInclude,
    });

    return presentOrder(updated);
  }

  async publicSettings(query: PublicQuery) {
    const tenant = await this.requirePublicShop(query);
    const settings = await this.ensureSettings(tenant.id);
    if (!settings.isEnabled) {
      throw new ApiException(API_ERROR_CODES.ORDERS_DISABLED);
    }
    return presentPublicSettings(settings, tenant.currency, {
      onlinePaymentEnabled: this.paydunya.isEnabled(),
    });
  }

  async quote(query: PublicQuery, input: QuoteOrderDto) {
    const tenant = await this.requirePublicShop(query);
    const settings = await this.requireEnabledSettings(tenant.id);
    const priced = await this.priceItems(tenant.id, input, settings, { requireAddress: false });
    return presentQuote({
      currency: tenant.currency,
      fulfillment: input.fulfillment,
      items: priced.items,
      ...priced.totals,
    });
  }

  async listMine(customerUserId: string, query: PublicQuery) {
    const tenant = await this.requirePublicCustomer(customerUserId, query);
    const orders = await this.prisma.order.findMany({
      where: { tenantId: tenant.id, customerUserId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return orders.map(presentOrder);
  }

  async publicCreate(query: PublicQuery, input: CreateOrderDto, customerUserId: string) {
    const tenant = await this.requirePublicCustomer(customerUserId, query);
    const customer = await this.prisma.user.findUnique({
      where: { id: customerUserId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!customer) {
      throw new ApiException(API_ERROR_CODES.UNAUTHORIZED);
    }
    const customerName = customer.name.trim();
    const customerEmail = customer.email?.trim().toLowerCase() || null;
    const customerPhone = customer.phone?.trim() || input.customerPhone?.trim() || null;
    if (!customerPhone) {
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Indiquez un numéro de téléphone pour finaliser la commande",
      );
    }
    if (!customer.phone?.trim()) {
      await this.prisma.user.update({
        where: { id: customer.id },
        data: { phone: customerPhone },
      });
    }

    const settings = await this.requireEnabledSettings(tenant.id);
    const priced = await this.priceItems(tenant.id, input, settings);
    const paymentMethod = input.paymentMethod ?? "wave";
    if (paymentMethod === "cod") {
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Le paiement à la livraison n'est plus disponible. Choisissez Wave, Orange Money ou MTN MoMo.",
      );
    }
    const paydunyaEnabled = this.paydunya.isEnabled();
    const simulateOnline = !paydunyaEnabled;

    if (paydunyaEnabled && (!input.returnUrl || !input.cancelUrl)) {
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Les URLs de retour et d'annulation sont requises pour le paiement en ligne",
      );
    }

    const paidAt = simulateOnline ? new Date() : null;
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, tenant.id);
      return tx.order.create({
        data: {
          tenantId: tenant.id,
          number,
          fulfillment: input.fulfillment,
          customerUserId,
          customerName,
          customerEmail,
          customerPhone,
          addressLine: input.fulfillment === "DELIVERY" ? input.addressLine : null,
          city: input.fulfillment === "DELIVERY" ? input.city : null,
          region: input.fulfillment === "DELIVERY" ? (input.region ?? null) : null,
          postalCode: input.fulfillment === "DELIVERY" ? (input.postalCode ?? null) : null,
          note: input.note ?? null,
          subtotalXof: priced.totals.subtotalXof,
          deliveryFeeXof: priced.totals.deliveryFeeXof,
          totalXof: priced.totals.totalXof,
          currency: tenant.currency,
          paymentMethod,
          paymentProvider: paydunyaEnabled ? "PAYDUNYA" : "NONE",
          paymentStatus: simulateOnline ? "PAID" : "PENDING",
          paidAt,
          status: simulateOnline ? "CONFIRMED" : "PENDING",
          items: { create: priced.items },
          events: {
            create: [
              {
                type: "CREATED",
                toStatus: simulateOnline ? "CONFIRMED" : "PENDING",
                message: "Commande créée depuis le site",
              },
              ...(simulateOnline
                ? [
                    {
                      type: "PAYMENT" as const,
                      fromStatus: "PENDING" as const,
                      toStatus: "CONFIRMED" as const,
                      message: `Paiement ${paymentMethod} simulé (PayDunya désactivé)`,
                    },
                  ]
                : []),
            ],
          },
        },
        include: orderInclude,
      });
    });

    if (simulateOnline) {
      if (simulateOnline && paidAt) {
        await this.wallet.creditOrderSale({
          id: created.id,
          tenantId: created.tenantId,
          totalXof: created.totalXof,
          paidAt,
        });
      }
      await this.notifyOrder(created, settings, "created");
      await this.proNotifications.notifyOrderCreated({
        tenantId: tenant.id,
        number: created.number,
        customerName: created.customerName,
        totalXof: created.totalXof,
        paymentMethod: created.paymentMethod,
        paymentStatus: created.paymentStatus,
        createdAt: created.createdAt,
      });
      if (simulateOnline) {
        await this.proNotifications.notifyPaymentReceived({
          tenantId: tenant.id,
          number: created.number,
          totalXof: created.totalXof,
          paymentMethod: created.paymentMethod,
        });
      }
      return {
        ...presentOrder(await this.requireOrder(tenant.id, created.id)),
        paymentUrl: null as string | null,
      };
    }

    if (paymentMethod === "card") {
      await this.prisma.order.update({
        where: { id: created.id },
        data: {
          paymentStatus: "FAILED",
          events: {
            create: {
              type: "PAYMENT",
              message: "Carte bancaire SoftPay non activée (PCI-DSS requis)",
            },
          },
        },
      });
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Le paiement par carte n’est pas encore disponible. Choisissez Wave, Orange Money ou MTN.",
      );
    }

    const softMethod = paymentMethod as "wave" | "orange" | "mtn";
    const callbackUrl = `${getApiUrl().replace(/\/$/, "")}/api/storefront/payments/paydunya/ipn`;
    try {
      const invoice = await this.paydunya.createCheckoutInvoice({
        totalAmount: created.totalXof,
        description: `Commande ${created.number} · ${tenant.name}`,
        storeName: tenant.name,
        storeTagline: tenant.site?.tagline ?? tenant.description,
        storePhone: tenant.site?.phone ?? tenant.contactPhone,
        customerName: created.customerName,
        customerEmail: created.customerEmail,
        customerPhone: created.customerPhone,
        items: created.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPriceXof,
          totalPrice: item.lineTotalXof,
          description: item.variantName ?? "",
        })),
        customData: {
          orderId: created.id,
          orderNumber: created.number,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
        returnUrl: input.returnUrl!,
        cancelUrl: input.cancelUrl!,
        callbackUrl,
      });

      const soft = await this.paydunya.softPay({
        method: softMethod,
        invoiceToken: invoice.token,
        customerName: created.customerName,
        customerEmail: created.customerEmail || "",
        customerPhone: created.customerPhone,
        otp: input.paymentOtp,
      });

      const updated = await this.prisma.order.update({
        where: { id: created.id },
        data: {
          paydunyaToken: invoice.token,
          paydunyaInvoiceUrl: soft.paymentUrl ?? invoice.invoiceUrl,
          events: {
            create: {
              type: "PAYMENT",
              message: `SoftPay ${softMethod} · ${soft.message} (${invoice.token})`,
            },
          },
        },
        include: orderInclude,
      });

      await this.notifyOrder(updated, settings, "created");
      await this.proNotifications.notifyOrderCreated({
        tenantId: tenant.id,
        number: updated.number,
        customerName: updated.customerName,
        totalXof: updated.totalXof,
        paymentMethod: updated.paymentMethod,
        paymentStatus: updated.paymentStatus,
        createdAt: updated.createdAt,
      });
      return {
        ...presentOrder(updated),
        paymentUrl: soft.paymentUrl,
        paymentMessage: soft.message,
        awaitCustomerConfirmation: soft.awaitCustomerConfirmation,
      };
    } catch (error) {
      await this.prisma.order.update({
        where: { id: created.id },
        data: {
          paymentStatus: "FAILED",
          events: {
            create: {
              type: "PAYMENT",
              message: "Échec SoftPay PayDunya",
            },
          },
        },
      });
      throw error;
    }
  }

  async handlePaydunyaIpn(body: unknown) {
    const payload = this.paydunya.parseIpnPayload(body);
    if (!payload) {
      this.logger.warn("PayDunya IPN: payload invalide");
      return { received: true };
    }

    const hash =
      typeof payload.raw.hash === "string"
        ? payload.raw.hash
        : typeof (body as { hash?: string })?.hash === "string"
          ? (body as { hash: string }).hash
          : null;

    if (!this.paydunya.verifyIpnHash(hash)) {
      this.logger.warn(`PayDunya IPN: hash invalide token=${payload.token ?? "?"}`);
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Signature PayDunya invalide");
    }

    const orderId = payload.customData.orderId;
    const order =
      (orderId
        ? await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude })
        : null) ||
      (payload.token
        ? await this.prisma.order.findFirst({
            where: { paydunyaToken: payload.token },
            include: orderInclude,
          })
        : null);

    if (!order) {
      this.logger.warn(`PayDunya IPN: commande introuvable token=${payload.token ?? "?"} orderId=${orderId ?? "?"}`);
      return { received: true };
    }

    if (payload.status === "completed") {
      if (order.paymentStatus === "PAID") {
        return { received: true, orderNumber: order.number };
      }
      if (payload.totalAmount !== null && payload.totalAmount !== order.totalXof) {
        this.logger.warn(
          `PayDunya IPN: montant différent orderId=${order.id} expected=${order.totalXof} got=${payload.totalAmount}`,
        );
      }

      const paidAt = new Date();
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          paidAt,
          status: order.status === "PENDING" ? "CONFIRMED" : order.status,
          events: {
            create: {
              type: "PAYMENT",
              fromStatus: order.status,
              toStatus: order.status === "PENDING" ? "CONFIRMED" : order.status,
              message: "Paiement PayDunya confirmé",
            },
          },
        },
        include: orderInclude,
      });
      await this.wallet.creditOrderSale({
        id: updated.id,
        tenantId: updated.tenantId,
        totalXof: updated.totalXof,
        paidAt,
      });
      const settings = await this.ensureSettings(order.tenantId);
      await this.notifyOrder(updated, settings, "status");
      await this.proNotifications.notifyOrderCreated({
        tenantId: updated.tenantId,
        number: updated.number,
        customerName: updated.customerName,
        totalXof: updated.totalXof,
        paymentMethod: updated.paymentMethod,
        paymentStatus: updated.paymentStatus,
        createdAt: updated.createdAt,
      });
      await this.proNotifications.notifyPaymentReceived({
        tenantId: updated.tenantId,
        number: updated.number,
        totalXof: updated.totalXof,
        paymentMethod: updated.paymentMethod,
      });
      return { received: true, orderNumber: updated.number, paymentStatus: updated.paymentStatus };
    }

    if (payload.status === "cancelled" || payload.status === "canceled") {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "CANCELLED",
          events: {
            create: { type: "PAYMENT", message: "Paiement PayDunya annulé" },
          },
        },
      });
      return { received: true, orderNumber: order.number, paymentStatus: "CANCELLED" };
    }

    if (payload.status === "failed") {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED",
          events: {
            create: { type: "PAYMENT", message: "Paiement PayDunya échoué" },
          },
        },
      });
      return { received: true, orderNumber: order.number, paymentStatus: "FAILED" };
    }

    return { received: true, orderNumber: order.number, status: payload.status };
  }

  async handlePaydunyaCashoutIpn(body: unknown) {
    this.logger.log(`PayDunya cashout IPN: ${JSON.stringify(body)}`);
    return { received: true };
  }

  private async priceItems(
    tenantId: string,
    input: QuoteOrderDto & { addressLine?: string | null; city?: string | null },
    settings: OrderSettings,
    options?: { requireAddress?: boolean },
  ) {
    if (input.fulfillment === "DELIVERY" && !settings.deliveryEnabled) {
      throw new ApiException(API_ERROR_CODES.FULFILLMENT_UNAVAILABLE, undefined, { fulfillment: "DELIVERY" });
    }
    if (input.fulfillment === "PICKUP" && !settings.pickupEnabled) {
      throw new ApiException(API_ERROR_CODES.FULFILLMENT_UNAVAILABLE, undefined, { fulfillment: "PICKUP" });
    }
    if (options?.requireAddress !== false && input.fulfillment === "DELIVERY" && (!input.addressLine || !input.city)) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "L'adresse et la ville sont requises pour la livraison");
    }

    const items = [];
    for (const line of input.items) {
      if (!line.productId && !line.productSlug) {
        throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez le produit commandé");
      }
      const product = await this.prisma.product.findFirst({
        where: line.productId ? { id: line.productId, tenantId } : { slug: line.productSlug, tenantId },
        include: { variants: true },
      });
      if (!product || !product.isActive || !product.isPublished) {
        throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
      }
      if (product.availability === "OUT_OF_STOCK") {
        throw new ApiException(API_ERROR_CODES.PRODUCT_UNAVAILABLE, undefined, { productId: product.id });
      }
      const variantNameHint = line.variantName?.trim() || null;
      const variant = line.variantId
        ? product.variants.find((item) => item.id === line.variantId)
        : line.variantSku
          ? product.variants.find((item) => item.sku === line.variantSku)
          : variantNameHint
            ? product.variants.find(
                (item) =>
                  item.id === variantNameHint ||
                  item.name === variantNameHint ||
                  item.name.toLowerCase() === variantNameHint.toLowerCase(),
              )
            : null;
      if ((line.variantId || line.variantSku || variantNameHint) && !variant) {
        throw new ApiException(API_ERROR_CODES.VARIANT_NOT_FOUND);
      }
      if (variant && (!variant.isActive || variant.availability === "OUT_OF_STOCK")) {
        throw new ApiException(API_ERROR_CODES.PRODUCT_UNAVAILABLE, undefined, { variantId: variant.id });
      }
      const unitPriceXof = variant?.priceXof ?? product.priceXof;
      items.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        productName: product.name,
        variantName: variant?.name ?? null,
        unitPriceXof,
        quantity: line.quantity,
        lineTotalXof: unitPriceXof * line.quantity,
      });
    }

    const totals = orderTotals({
      lines: items,
      fulfillment: input.fulfillment,
      deliveryFeeXof: settings.deliveryFeeXof,
      freeDeliveryFromXof: settings.freeDeliveryFromXof,
    });
    if (totals.subtotalXof < settings.minOrderXof) {
      throw new ApiException(API_ERROR_CODES.MIN_ORDER_NOT_MET, undefined, { minOrderXof: settings.minOrderXof });
    }
    return { items, totals };
  }

  private async nextNumber(tx: Prisma.TransactionClient, tenantId: string) {
    const count = await tx.order.count({ where: { tenantId } });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const number = formatOrderNumber(count + attempt);
      const taken = await tx.order.findUnique({
        where: { tenantId_number: { tenantId, number } },
        select: { id: true },
      });
      if (!taken) {
        return number;
      }
    }
    return formatOrderNumber(Date.now() % 100_000);
  }

  private async notifyOrder(
    order: {
      id: string;
      number: string;
      tenantId: string;
      customerName: string;
      customerEmail: string | null;
      customerPhone: string;
      totalXof: number;
      currency: string;
      status: string;
      fulfillment: string;
    },
    settings: OrderSettings,
    kind: "created" | "status",
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: order.tenantId },
      select: { name: true, category: true },
    });
    const shop = tenant?.name ?? "Boutik";
    if (settings.notifyEmail && order.customerEmail) {
      try {
        if (kind === "created") {
          await this.notifications.sendOrderCreated({
            to: order.customerEmail,
            shop,
            customerName: order.customerName,
            number: order.number,
            totalXof: order.totalXof,
            currency: order.currency,
            fulfillment: order.fulfillment,
          });
        } else {
          await this.notifications.sendOrderStatus({
            to: order.customerEmail,
            shop,
            customerName: order.customerName,
            number: order.number,
            status: order.status,
          });
        }
        await this.prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "NOTIFICATION",
            channel: "EMAIL",
            message: kind === "created" ? "Récapitulatif envoyé par e-mail" : "Mise à jour envoyée par e-mail",
          },
        });
      } catch {
        await this.prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "NOTIFICATION",
            channel: "EMAIL",
            message: "Échec d'envoi de l'e-mail",
          },
        });
      }
    }
    // Module SMS : Boutique uniquement pour l’instant (Vitrine / Restaurant plus tard).
    const smsModuleActive = await this.modules.isActive(order.tenantId, SMS_MODULE_SLUG);
    if (smsModuleActive && tenant?.category === "BOUTIQUE" && order.customerPhone) {
      const result = await this.notifications.sendOrderSms({
        phone: order.customerPhone,
        number: order.number,
        status: order.status,
        shop,
      });
      await this.prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "NOTIFICATION",
          channel: "SMS",
          message: result.ok
            ? result.skipped
              ? "SMS journalisé (eSMS désactivé)"
              : "SMS de statut envoyé"
            : `Échec SMS : ${result.error ?? "inconnu"}`,
        },
      });
    } else if (settings.notifySms && !smsModuleActive) {
      await this.prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "NOTIFICATION",
          channel: "SMS",
          message: "SMS ignoré : module SMS non activé",
        },
      });
    }
  }

  private async requireEnabledSettings(tenantId: string) {
    const settings = await this.ensureSettings(tenantId);
    if (!settings.isEnabled) {
      throw new ApiException(API_ERROR_CODES.ORDERS_DISABLED);
    }
    return settings;
  }

  private async ensureSettings(tenantId: string) {
    const existing = await this.prisma.orderSettings.findUnique({ where: { tenantId } });
    if (existing) {
      return existing;
    }
    return this.prisma.orderSettings.create({
      data: { tenantId, freeDeliveryFromXof: 20000 },
    });
  }

  private async requireOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: orderInclude,
    });
    if (!order) {
      throw new ApiException(API_ERROR_CODES.ORDER_NOT_FOUND);
    }
    return order;
  }

  private async requireOrders(userId: string, tenantId: string, options?: { mutate?: boolean }) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, options);
    assertOfferingCapability(tenant, "orders");
    return tenant;
  }

  private async requirePublicCustomer(customerUserId: string, input: PublicQuery) {
    const tenant = await this.requirePublicShop(input);
    const customer = await this.prisma.tenantCustomer.findUnique({
      where: { userId_tenantId: { userId: customerUserId, tenantId: tenant.id } },
    });
    if (!customer) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte n'est pas client de cet espace");
    }
    return tenant;
  }

  private async requirePublicShop(input: PublicQuery) {
    const slug = input.slug?.trim().toLowerCase() || tenantSlugFromHost(input.host);
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un slug ou un sous-domaine");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { ...workspaceWithRelations, site: true },
    });
    if (!tenant?.site) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    const status = sitePublicStatus(tenant.status, tenant.site.status);
    if (status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug });
    }
    if (status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.TENANT_SUSPENDED, undefined, { slug });
    }
    if (status !== "PUBLISHED") {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    assertOfferingCapability(tenant, "orders");
    return tenant;
  }
}
