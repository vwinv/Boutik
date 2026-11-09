import { Injectable, StreamableFile } from "@nestjs/common";
import { API_ERROR_CODES, proNetSaleXof, siteHost, sitePublicStatus, siteUrl } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { CatalogService } from "../catalog/catalog.service";
import type { UpdateOfferingDto } from "../catalog/dto/admin-catalog.dto";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentsStorage } from "./documents.storage";
import type { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import type { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { SubscriptionLifecycleService } from "../billing/subscription-lifecycle.service";
import { assertOfferingCapability } from "../catalog/effective-capabilities";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { SupportService } from "../support/support.service";
import { WalletService } from "../wallet/wallet.service";
import { TenantAccessService } from "./tenant-access.service";
import type { CreateSupportTicketDto, ReplySupportTicketDto } from "./dto/support-ticket.dto";
import {
  isWorkspaceReady,
  presentDocument,
  presentWorkspace,
  workspaceWithRelations,
} from "./workspace.presenter";

const MAX_DOCUMENTS = 20;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly storage: DocumentsStorage,
    private readonly catalog: CatalogService,
    private readonly wallet: WalletService,
    private readonly proNotifications: ProNotificationsService,
    private readonly support: SupportService,
    private readonly subscriptions: SubscriptionLifecycleService,
  ) {}

  async create(userId: string, professionalId: string, input: CreateWorkspaceDto) {
    await this.access.getOwnedProfessional(userId, professionalId);

    const defaultPlan = await this.catalog.defaultPlan(input.category);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          professionalId,
          slug: input.slug,
          name: input.name,
          category: input.category,
          status: "DRAFT",
          planId: defaultPlan?.id,
          planInterval: "MONTHLY",
          ...companyData(input),
        },
      });
      await tx.membership.create({
        data: { userId, tenantId: created.id, role: "OWNER" },
      });
      return tx.tenant.findFirstOrThrow({
        where: { id: created.id },
        include: workspaceWithRelations,
      });
    });

    await this.subscriptions.ensureDefaultFreeSubscription(tenant.id);

    return presentWorkspace(
      await this.prisma.tenant.findFirstOrThrow({
        where: { id: tenant.id },
        include: workspaceWithRelations,
      }),
    );
  }

  async listMine(userId: string) {
    const tenants = await this.prisma.tenant.findMany({
      where: this.access.workspaceWhereForUser(userId),
      include: workspaceWithRelations,
      orderBy: { name: "asc" },
    });
    return tenants.map(presentWorkspace);
  }

  async getMine(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return presentWorkspace(tenant);
  }

  /** Clients boutique : comptes liés + acheteurs issus des commandes. */
  async listCustomers(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    assertOfferingCapability(tenant, "customers");
    const [registered, orders] = await Promise.all([
      this.prisma.tenantCustomer.findMany({
        where: { tenantId: tenant.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true,
          customerUserId: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          totalXof: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    type Acc = {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      ordersCount: number;
      totalSpentXof: number;
      lastOrderAt: string | null;
      registered: boolean;
    };

    const byKey = new Map<string, Acc>();
    const phoneToKey = new Map<string, string>();
    const emailToKey = new Map<string, string>();

    const upsert = (input: {
      key: string;
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      registered?: boolean;
      orderTotal?: number;
      orderAt?: Date;
      countOrder?: boolean;
    }) => {
      const current = byKey.get(input.key);
      if (!current) {
        byKey.set(input.key, {
          id: input.id,
          name: input.name,
          phone: input.phone,
          email: input.email,
          ordersCount: input.countOrder ? 1 : 0,
          totalSpentXof: input.countOrder ? (input.orderTotal ?? 0) : 0,
          lastOrderAt: input.orderAt ? input.orderAt.toISOString() : null,
          registered: Boolean(input.registered),
        });
      } else {
        if (input.name.trim()) current.name = input.name;
        if (input.phone) current.phone = input.phone;
        if (input.email) current.email = input.email;
        if (input.registered) current.registered = true;
        if (input.countOrder) {
          current.ordersCount += 1;
          current.totalSpentXof += input.orderTotal ?? 0;
          if (input.orderAt) {
            const prev = current.lastOrderAt ? new Date(current.lastOrderAt).getTime() : 0;
            if (input.orderAt.getTime() >= prev) current.lastOrderAt = input.orderAt.toISOString();
          }
        }
      }
      const phoneKey = normalizeCustomerKey(input.phone);
      if (phoneKey) phoneToKey.set(phoneKey, input.key);
      const emailKey = normalizeEmailKey(input.email);
      if (emailKey) emailToKey.set(emailKey, input.key);
    };

    for (const row of registered) {
      const phone = row.user.phone?.trim() || null;
      upsert({
        key: row.userId,
        id: row.userId,
        name: row.user.name,
        phone,
        email: row.user.email,
        registered: true,
      });
    }

    for (const order of orders) {
      if (order.status === "CANCELLED") continue;
      const phone = order.customerPhone?.trim() || null;
      const phoneKey = normalizeCustomerKey(phone);
      const emailKey = normalizeEmailKey(order.customerEmail);
      const key =
        (order.customerUserId && byKey.has(order.customerUserId) ? order.customerUserId : null) ||
        (phoneKey ? phoneToKey.get(phoneKey) : null) ||
        (emailKey ? emailToKey.get(emailKey) : null) ||
        order.customerUserId ||
        phoneKey ||
        emailKey ||
        order.id;
      upsert({
        key,
        id: order.customerUserId || key,
        name: order.customerName,
        phone,
        email: order.customerEmail,
        countOrder: true,
        orderTotal: order.totalXof,
        orderAt: order.createdAt,
      });
    }

    return [...byKey.values()].sort((a, b) => {
      const aTime = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
      const bTime = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.name.localeCompare(b.name, "fr");
    });
  }

  async getWallet(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    assertOfferingCapability(tenant, "wallet");
    return this.wallet.getOverview(tenant.id);
  }

  async listNotifications(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    await this.subscriptions.syncExpirationNotification(tenant.id);
    return this.proNotifications.listForTenant(tenant.id);
  }

  async markNotificationRead(userId: string, tenantId: string, notificationId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.proNotifications.markRead(tenant.id, notificationId);
  }

  async markAllNotificationsRead(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.proNotifications.markAllRead(tenant.id);
  }

  async archiveNotification(userId: string, tenantId: string, notificationId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.proNotifications.archive(tenant.id, notificationId);
  }

  async supportFaq(userId: string, tenantId: string) {
    await this.access.getWorkspaceForMember(userId, tenantId);
    return this.support.faq();
  }

  async listSupportTickets(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return this.support.listTickets(tenant.id);
  }

  async getSupportTicket(userId: string, tenantId: string, ticketId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return this.support.getTicket(tenant.id, ticketId);
  }

  async createSupportTicket(userId: string, tenantId: string, input: CreateSupportTicketDto) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.support.createTicket(tenant.id, userId, {
      subject: input.subject,
      category: input.category,
      message: input.message,
    });
  }

  async replySupportTicket(
    userId: string,
    tenantId: string,
    ticketId: string,
    input: ReplySupportTicketDto,
  ) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.support.reply(tenant.id, userId, ticketId, input.message);
  }

  async closeSupportTicket(userId: string, tenantId: string, ticketId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    return this.support.closeTicket(tenant.id, ticketId);
  }

  async requestWalletWithdrawal(
    userId: string,
    tenantId: string,
    input: { amountXof: number; destination: string; destinationName?: string; method?: string },
  ) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    assertOfferingCapability(tenant, "wallet");
    try {
      const result = await this.wallet.requestWithdrawal(tenant.id, userId, input);
      if (result.withdrawal) {
        await this.proNotifications.notifyWithdrawal({
          tenantId: tenant.id,
          amountXof: result.withdrawal.amountXof,
          destination: result.withdrawal.destination,
          withdrawalId: result.withdrawal.id,
        });
      }
      return result.overview;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "INVALID_AMOUNT") {
        throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Montant de retrait invalide (min. 1 000 FCFA)");
      }
      if (code === "INVALID_DESTINATION") {
        throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un numéro Mobile Money valide");
      }
      if (code === "INSUFFICIENT_BALANCE") {
        throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Solde disponible insuffisant");
      }
      if (code === "WALLET_FROZEN") {
        throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ce wallet est gelé par l’administration");
      }
      throw error;
    }
  }

  async listStock(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    assertOfferingCapability(tenant, "stock");
    const [products, restocks, orderItems] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId: tenant.id },
        include: {
          category: { select: { id: true, name: true } },
          variants: {
            where: { isActive: true },
            select: { id: true, name: true, stockQty: true, lowStockThreshold: true, availability: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.stockMovement.findMany({
        where: { tenantId: tenant.id },
        include: { product: { select: { id: true, name: true, variants: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { tenantId: tenant.id, status: { not: "CANCELLED" } },
        },
        select: {
          id: true,
          quantity: true,
          productId: true,
          productName: true,
          variantName: true,
          createdAt: true,
          order: { select: { id: true, number: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    const levels = products
      .filter((product) => product.isActive)
      .flatMap((product) => {
        const categoryName = product.category?.name ?? null;
        if (product.variants.length > 0) {
          return product.variants.map((variant) => {
            const qty = variant.stockQty ?? (variant.availability === "OUT_OF_STOCK" ? 0 : null);
            const availability = variant.availability ?? product.availability;
            return {
              id: `${product.id}:${variant.id}`,
              productId: product.id,
              variantId: variant.id,
              name: `${product.name} · ${variant.name}`,
              productName: product.name,
              variantName: variant.name,
              categoryName,
              stockQty: qty,
              lowStockThreshold: variant.lowStockThreshold,
              status: stockStatus(qty, variant.lowStockThreshold, availability),
              hasVariants: true,
            };
          });
        }
        const qty = product.stockQty ?? (product.availability === "OUT_OF_STOCK" ? 0 : null);
        return [
          {
            id: product.id,
            productId: product.id,
            variantId: null as string | null,
            name: product.name,
            productName: product.name,
            variantName: null as string | null,
            categoryName,
            stockQty: qty,
            lowStockThreshold: product.lowStockThreshold,
            status: stockStatus(qty, product.lowStockThreshold, product.availability),
            hasVariants: false,
          },
        ];
      });

    const trackedQtys = levels.map((item) => item.stockQty).filter((value): value is number => value != null);
    const unitsInStock = trackedQtys.reduce((sum, value) => sum + value, 0);
    const lowStock = levels.filter((item) => item.status === "LOW").length;
    const outOfStock = levels.filter((item) => item.status === "OUT").length;
    const barMax = Math.max(40, ...trackedQtys, 1);

    const restockMovements = restocks.map((row) => {
      const variantName = row.variantId
        ? row.product.variants.find((variant) => variant.id === row.variantId)?.name
        : null;
      return {
        id: row.id,
        delta: row.delta,
        productId: row.productId,
        productName: variantName ? `${row.product.name} · ${variantName}` : row.product.name,
        label: row.note?.trim() || (row.reason === "RESTOCK" ? "Réapprovisionnement" : "Ajustement"),
        reason: row.reason as "ORDER" | "RESTOCK" | "ADJUSTMENT",
        createdAt: row.createdAt.toISOString(),
      };
    });

    const movements = [
      ...restockMovements,
      ...orderItems.map((item) => ({
        id: `order:${item.id}`,
        delta: -item.quantity,
        productId: item.productId,
        productName: item.variantName ? `${item.productName} · ${item.variantName}` : item.productName,
        label: `Commande ${item.order.number}`,
        reason: "ORDER" as const,
        createdAt: item.order.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    return {
      summary: {
        unitsInStock,
        lowStock,
        outOfStock,
        activeRefs: levels.length,
      },
      barMax,
      levels,
      movements,
    };
  }

  async restockProduct(
    userId: string,
    tenantId: string,
    productId: string,
    input: { quantity?: number; variantId?: string },
  ) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    assertOfferingCapability(tenant, "stock");
    const quantity = input.quantity ?? 10;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Quantité invalide");
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: tenant.id },
      include: {
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
    }

    const activeVariants = product.variants;
    let variantId: string | null = null;

    if (activeVariants.length > 0) {
      const target =
        (input.variantId ? activeVariants.find((item) => item.id === input.variantId) : null) ||
        [...activeVariants].sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0))[0];
      if (!target) {
        throw new ApiException(API_ERROR_CODES.VARIANT_NOT_FOUND);
      }
      variantId = target.id;
      const nextQty = (target.stockQty ?? 0) + quantity;
      await this.prisma.productVariant.update({
        where: { id: target.id },
        data: {
          stockQty: nextQty,
          availability: nextQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
        },
      });
      const remaining = activeVariants.map((item) =>
        item.id === target.id ? nextQty : (item.stockQty ?? 0),
      );
      const productOut = remaining.every((value) => value === 0);
      await this.prisma.product.update({
        where: { id: product.id },
        data: { availability: productOut ? "OUT_OF_STOCK" : "IN_STOCK" },
      });
    } else {
      const nextQty = (product.stockQty ?? 0) + quantity;
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          stockQty: nextQty,
          availability: nextQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
        },
      });
    }

    await this.prisma.stockMovement.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        variantId,
        delta: quantity,
        reason: "RESTOCK",
        note: "Réapprovisionnement",
      },
    });

    return this.listStock(userId, tenant.id);
  }

  async dashboard(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    const now = new Date();
    const start7 = startOfDay(addDays(now, -6));
    const start30 = startOfDay(addDays(now, -29));
    const startPrev30 = startOfDay(addDays(now, -59));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekGoalDefault = 3_500_000;

    const [orders, products, customersTotal, customersWeek, site, walletBalances] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId: tenant.id, createdAt: { gte: startPrev30 } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          fulfillment: true,
          customerName: true,
          totalXof: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, availability: true, priceXof: true },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.tenantCustomer.count({ where: { tenantId: tenant.id } }),
      this.prisma.tenantCustomer.count({
        where: { tenantId: tenant.id, createdAt: { gte: start7 } },
      }),
      this.prisma.tenantSite.findUnique({
        where: { tenantId: tenant.id },
        select: { status: true, title: true },
      }),
      this.wallet.getBalances(tenant.id),
    ]);

    const activeOrders = orders.filter((order) => order.status !== "CANCELLED");
    const last30 = activeOrders.filter((order) => order.createdAt >= start30);
    const prev30 = activeOrders.filter((order) => order.createdAt >= startPrev30 && order.createdAt < start30);
    const last7 = activeOrders.filter((order) => order.createdAt >= start7);
    const monthOrders = activeOrders.filter((order) => order.createdAt >= monthStart);

    const revenue30 = sumTotals(last30);
    const revenuePrev30 = sumTotals(prev30);
    const revenue7 = sumTotals(last7);
    const revenueMonth = sumTotals(monthOrders);

    const toProcess = activeOrders.filter((order) =>
      ["PENDING", "CONFIRMED", "PREPARING"].includes(order.status),
    ).length;

    const pendingBalance = sumTotals(
      activeOrders.filter((order) => order.paymentStatus === "PENDING" || order.paymentStatus === "COD"),
    );

    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start7, index);
      const dayEnd = addDays(startOfDay(day), 1);
      const dayOrders = last7.filter((order) => order.createdAt >= startOfDay(day) && order.createdAt < dayEnd);
      const total = sumTotals(dayOrders);
      return {
        key: day.toISOString().slice(0, 10),
        label: DAY_LABELS[day.getDay()] ?? "—",
        totalXof: total,
        count: dayOrders.length,
        isToday: startOfDay(day).getTime() === startOfDay(now).getTime(),
      };
    });

    const maxBar = Math.max(...weekDays.map((day) => day.totalXof), 1);
    const weekBars = weekDays.map((day) => ({
      ...day,
      valueK: Math.round(day.totalXof / 1000),
      heightPct: Math.round((day.totalXof / maxBar) * 100),
    }));

    const heat = buildHeatmap(last7);
    const goalTargetXof = Math.max(weekGoalDefault, Math.round(revenuePrev30 * 1.1) || weekGoalDefault);
    const goalPct = Math.min(100, Math.round((revenueMonth / goalTargetXof) * 100));

    const recentOrders = activeOrders.slice(0, 5).map((order) => ({
      id: order.id,
      number: order.number,
      customerName: order.customerName,
      totalXof: order.totalXof,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
    }));

    const stockAlerts = products
      .filter((product) => product.availability === "OUT_OF_STOCK")
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        availability: product.availability,
        priceXof: product.priceXof,
      }));

    const publicStatus = sitePublicStatus(tenant.status, site?.status ?? null);

    return {
      workspace: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        category: tenant.category,
        host: siteHost(tenant.slug),
        url: siteUrl(tenant.slug),
        siteTitle: site?.title ?? tenant.name,
        siteStatus: publicStatus,
      },
      kpis: {
        customersTotal,
        customersWeek,
        customersDeltaPct: pctDelta(customersWeek, Math.max(customersTotal - customersWeek, 0)),
        ordersTotal: last30.length,
        ordersDeltaPct: pctDelta(last30.length, prev30.length),
        ordersToProcess: toProcess,
        revenue30Xof: revenue30,
        revenue30DeltaPct: pctDelta(revenue30, revenuePrev30),
        balanceAvailableXof: walletBalances.availableXof,
        balanceWithdrawnXof: walletBalances.withdrawnXof,
        balancePendingXof: pendingBalance + walletBalances.holdXof,
        weekRevenueXof: revenue7,
        monthRevenueXof: revenueMonth,
        goalTargetXof,
        goalPct,
      },
      weekBars,
      heat,
      recentOrders,
      stockAlerts,
      catalog: {
        productsActive: products.length,
        outOfStock: stockAlerts.length,
      },
    };
  }

  async updateMine(userId: string, tenantId: string, input: UpdateWorkspaceDto) {
    const current = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    let planId = current.planId;
    let subcategoryId = current.subcategoryId;
    let templateId = current.templateId;
    let clearOptions = false;

    if (input.category && input.category !== current.category) {
      const defaultPlan = await this.catalog.defaultPlan(input.category);
      planId = defaultPlan?.id ?? null;
      subcategoryId = null;
      templateId = null;
      clearOptions = true;
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      if (clearOptions) {
        await tx.tenantPlanOption.deleteMany({ where: { tenantId } });
      }
      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          slug: input.slug,
          name: input.name,
          category: input.category,
          planId,
          subcategoryId,
          templateId,
          ...companyData(input),
        },
        include: workspaceWithRelations,
      });
    });
    return presentWorkspace(tenant);
  }

  async catalogFor(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    const [subcategories, plans, templates] = await Promise.all([
      this.prisma.siteSubcategory.findMany({
        where: { category: tenant.category, isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.catalog.listPlans(tenant.category, true),
      this.catalog.listTemplates(tenant.category, true),
    ]);
    return {
      category: tenant.category,
      subcategories: subcategories.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
      })),
      plans,
      templates,
    };
  }

  async applyOffering(userId: string, tenantId: string, input: UpdateOfferingDto) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true, owner: true });
    const category = tenant.category;
    let plan = tenant.plan;
    let interval = input.interval ?? tenant.planInterval;
    let includesPremium = plan?.includesPremiumTemplates ?? false;

    if (input.planId) {
      plan = await this.catalog.requirePlan(input.planId, category);
      this.catalog.requirePrice(plan, interval);
      includesPremium = plan.includesPremiumTemplates;
    } else if (input.interval) {
      if (!plan) {
        throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
      }
      this.catalog.requirePrice(plan, interval);
    }

    if (input.subcategoryId) {
      await this.catalog.requireSubcategory(input.subcategoryId, category);
    }

    const nextPlanId = input.planId ?? tenant.planId;
    if (input.optionIds && !nextPlanId) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    const options = input.optionIds
      ? await this.catalog.requireOptions(input.optionIds, nextPlanId as string)
      : undefined;

    let nextTemplateId = tenant.templateId;
    if (input.templateId === null) {
      nextTemplateId = null;
    } else if (input.templateId) {
      await this.catalog.requireTemplate(input.templateId, category, includesPremium);
      nextTemplateId = input.templateId;
    } else if (tenant.template?.isPremium && !includesPremium) {
      nextTemplateId = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (options) {
        await tx.tenantPlanOption.deleteMany({ where: { tenantId } });
        if (options.length > 0) {
          await tx.tenantPlanOption.createMany({
            data: options.map((option) => ({ tenantId, optionId: option.id })),
          });
        }
      } else if (input.planId && input.planId !== tenant.planId) {
        await tx.tenantPlanOption.deleteMany({ where: { tenantId } });
      }

      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId: nextPlanId,
          planInterval: interval,
          subcategoryId: input.subcategoryId === null ? null : (input.subcategoryId ?? tenant.subcategoryId),
          templateId: nextTemplateId,
        },
        include: workspaceWithRelations,
      });
    });

    return presentWorkspace(updated);
  }

  async activateMine(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true, owner: true });
    if (tenant.status !== "DRAFT") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Seul un espace en brouillon peut être activé");
    }
    if (!isWorkspaceReady(tenant) || !tenant.planId) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_READY, undefined, {
        ...missingActivationFields(tenant),
        missing: [...missingActivationFields(tenant).missing, ...(tenant.planId ? [] : ["planId"])],
      });
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
      include: workspaceWithRelations,
    });
    return presentWorkspace(updated);
  }

  async listDocuments(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return tenant.documents.map(presentDocument);
  }

  async uploadDocument(
    userId: string,
    tenantId: string,
    kind: "IDENTITY" | "NINEA" | "RCCM" | "OTHER",
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Format de fichier non accepté (PDF, JPEG, PNG, WebP)");
    }

    const count = await this.prisma.tenantDocument.count({ where: { tenantId } });
    if (count >= MAX_DOCUMENTS) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Nombre maximal de documents atteint");
    }

    const document = await this.prisma.tenantDocument.create({
      data: {
        tenantId,
        kind,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "pending",
      },
    });

    const storageKey = this.storage.key(tenantId, document.id, file.originalname);
    try {
      await this.storage.save(storageKey, file.buffer);
    } catch (error) {
      await this.prisma.tenantDocument.delete({ where: { id: document.id } });
      throw error;
    }

    return presentDocument(
      await this.prisma.tenantDocument.update({
        where: { id: document.id },
        data: { storageKey },
      }),
    );
  }

  async removeDocument(userId: string, tenantId: string, documentId: string) {
    await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    const document = await this.prisma.tenantDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) {
      throw new ApiException(API_ERROR_CODES.DOCUMENT_NOT_FOUND);
    }
    await this.storage.remove(document.storageKey);
    await this.prisma.tenantDocument.delete({ where: { id: document.id } });
    return { deleted: true };
  }

  async downloadDocument(userId: string, tenantId: string, documentId: string) {
    await this.access.getWorkspaceForMember(userId, tenantId);
    const document = await this.prisma.tenantDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document || document.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    return new StreamableFile(this.storage.stream(document.storageKey), {
      type: document.mimeType,
      disposition: `attachment; filename="${document.originalName.replaceAll('"', "")}"`,
    });
  }
}

function companyData(input: CreateWorkspaceDto | UpdateWorkspaceDto) {
  return {
    legalName: input.legalName,
    ninea: input.ninea,
    rccm: input.rccm,
    addressLine: input.addressLine,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    website: input.website,
    description: input.description,
    timezone: input.timezone,
    locale: input.locale,
    currency: input.currency,
  };
}

function missingActivationFields(tenant: { name: string; slug: string; legalName: string | null; contactEmail: string | null; contactPhone: string | null }) {
  const missing: string[] = [];
  if (!tenant.name) {
    missing.push("name");
  }
  if (!tenant.slug) {
    missing.push("slug");
  }
  if (!tenant.legalName) {
    missing.push("legalName");
  }
  if (!tenant.contactEmail && !tenant.contactPhone) {
    missing.push("contactEmail");
    missing.push("contactPhone");
  }
  return { missing };
}

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function normalizeCustomerKey(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-11) : "";
}

function normalizeEmailKey(email: string | null | undefined) {
  const value = email?.trim().toLowerCase() || "";
  return value.includes("@") ? value : "";
}

function stockStatus(
  qty: number | null,
  threshold: number | null,
  availability: string,
): "OK" | "LOW" | "OUT" {
  if (qty === 0 || availability === "OUT_OF_STOCK") return "OUT";
  if (qty != null && threshold != null && qty > 0 && qty <= threshold) return "LOW";
  return "OK";
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

/** CA pro = montant réellement gagné (brut − commission Boutik 5 %). */
function sumTotals(orders: Array<{ totalXof: number }>) {
  return orders.reduce((sum, order) => sum + proNetSaleXof(order.totalXof), 0);
}

function pctDelta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildHeatmap(orders: Array<{ createdAt: Date }>) {
  // 3 rows (matin/midi/soir) × 6 cols (lun→sam of current window ending today)
  const rows = [
    Array.from({ length: 6 }, () => 0),
    Array.from({ length: 6 }, () => 0),
    Array.from({ length: 6 }, () => 0),
  ];
  for (const order of orders) {
    const day = order.createdAt.getDay(); // 0 sun .. 6 sat
    if (day === 0) continue; // skip dimanche for 6-col grid M-S
    const col = day - 1; // mon=0
    const hour = order.createdAt.getHours();
    const row = hour < 12 ? 0 : hour < 17 ? 1 : 2;
    rows[row]![col]! += 1;
  }
  const max = Math.max(1, ...rows.flat());
  return rows.map((row) =>
    row.map((count) => {
      if (count <= 0) return 1;
      if (count / max < 0.34) return 2;
      if (count / max < 0.67) return 3;
      return 4;
    }),
  );
}
