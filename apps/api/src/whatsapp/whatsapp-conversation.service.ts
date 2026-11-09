import { Injectable, Logger } from "@nestjs/common";
import { formatOrderNumber } from "@boutik/domain";
import { Prisma } from "@prisma/client";
import { ModulesService, WHATSAPP_ORDERS_MODULE_SLUG } from "../modules/modules.service";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappCloudService } from "./whatsapp-cloud.service";

type CartLine = {
  productId: string;
  name: string;
  priceXof: number;
  quantity: number;
};

type Draft = {
  fulfillment?: "PICKUP" | "DELIVERY";
  addressLine?: string;
  city?: string;
  customerName?: string;
  pendingProductId?: string;
};

type IncomingMessage = {
  phoneNumberId: string;
  from: string;
  text?: string;
  buttonId?: string;
  listId?: string;
  contactName?: string;
};

@Injectable()
export class WhatsappConversationService {
  private readonly logger = new Logger(WhatsappConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: WhatsappCloudService,
    private readonly modules: ModulesService,
    private readonly proNotifications: ProNotificationsService,
  ) {}

  async handleIncoming(message: IncomingMessage) {
    const config = await this.prisma.tenantWhatsAppConfig.findUnique({
      where: { phoneNumberId: message.phoneNumberId },
      include: { tenant: { select: { id: true, name: true, category: true, currency: true } } },
    });
    if (!config || !config.isEnabled) {
      this.logger.warn({ phoneNumberId: message.phoneNumberId }, "WhatsApp config introuvable");
      return;
    }
    if (config.tenant.category !== "BOUTIQUE") return;
    const active = await this.modules.isActive(config.tenantId, WHATSAPP_ORDERS_MODULE_SLUG);
    if (!active) {
      await this.cloud.sendText({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        to: message.from,
        text: "La boutique WhatsApp n’est pas active pour le moment.",
      });
      return;
    }

    const session = await this.loadSession(config.tenantId, message.from);
    const reply = message.buttonId || message.listId || message.text?.trim() || "";
    const ctx = {
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      to: message.from,
      shop: config.tenant.name,
      tenantId: config.tenantId,
      currency: config.tenant.currency || "XOF",
    };

    try {
      if (!reply || isGreeting(reply) || reply === "menu" || reply === "aide") {
        await this.sendMenu(ctx, session);
        return;
      }
      if (reply === "catalog" || reply === "catalogue") {
        await this.sendCategories(ctx, session);
        return;
      }
      if (reply === "cart" || reply === "panier") {
        await this.sendCart(ctx, session);
        return;
      }
      if (reply === "clear_cart") {
        session.cart = [];
        session.state = "menu";
        await this.saveSession(session);
        await this.cloud.sendText({
          ...ctx,
          text: "Panier vidé.",
        });
        await this.sendMenu(ctx, session);
        return;
      }
      if (reply.startsWith("cat:")) {
        await this.sendProducts(ctx, session, reply.slice(4));
        return;
      }
      if (reply.startsWith("prod:")) {
        session.draft.pendingProductId = reply.slice(5);
        session.state = "qty";
        await this.saveSession(session);
        await this.cloud.sendButtons({
          ...ctx,
          body: "Quelle quantité ?",
          buttons: [
            { id: "qty:1", title: "1" },
            { id: "qty:2", title: "2" },
            { id: "qty:3", title: "3" },
          ],
        });
        return;
      }
      if (reply.startsWith("qty:") || (session.state === "qty" && /^\d+$/.test(reply))) {
        const qty = reply.startsWith("qty:") ? Number(reply.slice(4)) : Number(reply);
        await this.addToCart(ctx, session, qty);
        return;
      }
      if (reply === "checkout") {
        session.state = "fulfillment";
        await this.saveSession(session);
        await this.cloud.sendButtons({
          ...ctx,
          body: "Comment souhaitez-vous recevoir la commande ?",
          buttons: [
            { id: "ful:PICKUP", title: "Retrait" },
            { id: "ful:DELIVERY", title: "Livraison" },
          ],
        });
        return;
      }
      if (reply.startsWith("ful:")) {
        const fulfillment = reply.slice(4) === "DELIVERY" ? "DELIVERY" : "PICKUP";
        session.draft.fulfillment = fulfillment;
        if (fulfillment === "DELIVERY") {
          session.state = "address";
          await this.saveSession(session);
          await this.cloud.sendText({
            ...ctx,
            text: "Indiquez votre adresse de livraison (rue, quartier, ville).",
          });
          return;
        }
        await this.askNameOrConfirm(ctx, session, message.contactName);
        return;
      }
      if (session.state === "address") {
        session.draft.addressLine = reply;
        session.draft.city = reply.split(",").pop()?.trim() || undefined;
        await this.askNameOrConfirm(ctx, session, message.contactName);
        return;
      }
      if (session.state === "name") {
        session.draft.customerName = reply;
        session.state = "confirm";
        await this.saveSession(session);
        await this.sendConfirm(ctx, session);
        return;
      }
      if (reply === "confirm_order") {
        await this.placeOrder(ctx, session);
        return;
      }
      if (reply === "cancel_order") {
        session.state = "menu";
        await this.saveSession(session);
        await this.cloud.sendText({ ...ctx, text: "Commande annulée. Vous pouvez reprendre quand vous voulez." });
        await this.sendMenu(ctx, session);
        return;
      }

      await this.sendMenu(ctx, session);
    } catch (err) {
      this.logger.error(
        { err: err instanceof Error ? err.message : err, tenantId: config.tenantId },
        "Erreur conversation WhatsApp",
      );
      await this.cloud.sendText({
        ...ctx,
        text: "Une erreur est survenue. Réessayez dans un instant ou tapez menu.",
      });
    }
  }

  private async sendMenu(
    ctx: { phoneNumberId: string; accessToken: string; to: string; shop: string },
    session: Session,
  ) {
    session.state = "menu";
    await this.saveSession(session);
    await this.cloud.sendButtons({
      ...ctx,
      body: `Bienvenue chez ${ctx.shop} 👋\nCommandez directement ici, sans passer par le site.`,
      footer: "Boutique WhatsApp Boutik",
      buttons: [
        { id: "catalog", title: "Catalogue" },
        { id: "cart", title: "Mon panier" },
        { id: "aide", title: "Aide" },
      ],
    });
  }

  private async sendCategories(
    ctx: { phoneNumberId: string; accessToken: string; to: string; tenantId: string; currency: string; shop: string },
    session: Session,
  ) {
    const categories = await this.prisma.productCategory.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 10,
    });
    const productsWithoutCat = await this.prisma.product.count({
      where: { tenantId: ctx.tenantId, isActive: true, isPublished: true, categoryId: null },
    });

    if (categories.length === 0) {
      await this.sendProducts(ctx, session, "all");
      return;
    }

    session.state = "categories";
    await this.saveSession(session);
    const rows = categories.map((category) => ({
      id: `cat:${category.id}`,
      title: category.name,
      description: "Voir les produits",
    }));
    if (productsWithoutCat > 0) {
      rows.push({ id: "cat:all", title: "Tous les produits", description: "Catalogue complet" });
    }
    await this.cloud.sendList({
      ...ctx,
      body: "Choisissez une catégorie :",
      buttonText: "Catégories",
      sections: [{ title: "Catalogue", rows: rows.slice(0, 10) }],
    });
  }

  private async sendProducts(
    ctx: {
      phoneNumberId: string;
      accessToken: string;
      to: string;
      tenantId: string;
      currency: string;
      shop: string;
    },
    session: Session,
    categoryId: string,
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
        isPublished: true,
        ...(categoryId !== "all" ? { categoryId } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 10,
    });
    if (products.length === 0) {
      await this.cloud.sendText({ ...ctx, text: "Aucun produit disponible dans cette catégorie." });
      await this.sendCategories(ctx, session);
      return;
    }
    session.state = "products";
    await this.saveSession(session);
    await this.cloud.sendList({
      ...ctx,
      body: "Sélectionnez un produit :",
      buttonText: "Produits",
      sections: [
        {
          title: "Produits",
          rows: products.map((product) => ({
            id: `prod:${product.id}`,
            title: product.name,
            description: `${product.priceXof.toLocaleString("fr-FR")} ${ctx.currency}`,
          })),
        },
      ],
    });
  }

  private async addToCart(
    ctx: { phoneNumberId: string; accessToken: string; to: string; tenantId: string; shop: string; currency: string },
    session: Session,
    quantity: number,
  ) {
    const qty = Number.isFinite(quantity) && quantity > 0 ? Math.min(99, Math.floor(quantity)) : 0;
    if (!qty || !session.draft.pendingProductId) {
      await this.cloud.sendText({ ...ctx, text: "Quantité invalide. Reprenez depuis le catalogue." });
      await this.sendMenu(ctx, session);
      return;
    }
    const product = await this.prisma.product.findFirst({
      where: {
        id: session.draft.pendingProductId,
        tenantId: ctx.tenantId,
        isActive: true,
        isPublished: true,
      },
    });
    if (!product) {
      await this.cloud.sendText({ ...ctx, text: "Produit introuvable." });
      await this.sendMenu(ctx, session);
      return;
    }
    const existing = session.cart.find((line) => line.productId === product.id);
    if (existing) existing.quantity += qty;
    else {
      session.cart.push({
        productId: product.id,
        name: product.name,
        priceXof: product.priceXof,
        quantity: qty,
      });
    }
    session.draft.pendingProductId = undefined;
    session.state = "cart";
    await this.saveSession(session);
    await this.sendCart(ctx, session);
  }

  private async sendCart(
    ctx: { phoneNumberId: string; accessToken: string; to: string },
    session: Session,
  ) {
    if (session.cart.length === 0) {
      await this.cloud.sendButtons({
        ...ctx,
        body: "Votre panier est vide.",
        buttons: [
          { id: "catalog", title: "Catalogue" },
          { id: "menu", title: "Menu" },
        ],
      });
      return;
    }
    const lines = session.cart
      .map((line) => `• ${line.quantity} × ${line.name} — ${formatXof(line.priceXof * line.quantity)}`)
      .join("\n");
    const total = session.cart.reduce((sum, line) => sum + line.priceXof * line.quantity, 0);
    await this.cloud.sendButtons({
      ...ctx,
      body: `🛒 Panier\n${lines}\n\nTotal : ${formatXof(total)}`,
      buttons: [
        { id: "checkout", title: "Commander" },
        { id: "catalog", title: "Ajouter" },
        { id: "clear_cart", title: "Vider" },
      ],
    });
  }

  private async askNameOrConfirm(
    ctx: { phoneNumberId: string; accessToken: string; to: string },
    session: Session,
    contactName?: string,
  ) {
    if (!session.draft.customerName) {
      if (contactName?.trim()) session.draft.customerName = contactName.trim();
    }
    if (!session.draft.customerName) {
      session.state = "name";
      await this.saveSession(session);
      await this.cloud.sendText({
        ...ctx,
        text: "Quel est votre nom pour la commande ?",
      });
      return;
    }
    session.state = "confirm";
    await this.saveSession(session);
    await this.sendConfirm(ctx, session);
  }

  private async sendConfirm(
    ctx: { phoneNumberId: string; accessToken: string; to: string },
    session: Session,
  ) {
    const total = session.cart.reduce((sum, line) => sum + line.priceXof * line.quantity, 0);
    const mode = session.draft.fulfillment === "DELIVERY" ? "Livraison" : "Retrait";
    const address =
      session.draft.fulfillment === "DELIVERY" ? `\nAdresse : ${session.draft.addressLine || "—"}` : "";
    await this.cloud.sendButtons({
      ...ctx,
      body: `Confirmer la commande ?\nClient : ${session.draft.customerName}\nMode : ${mode}${address}\nTotal : ${formatXof(total)}\n\nPaiement à convenir avec la boutique.`,
      buttons: [
        { id: "confirm_order", title: "Confirmer" },
        { id: "cancel_order", title: "Annuler" },
      ],
    });
  }

  private async placeOrder(
    ctx: {
      phoneNumberId: string;
      accessToken: string;
      to: string;
      tenantId: string;
      shop: string;
      currency: string;
    },
    session: Session,
  ) {
    if (session.cart.length === 0) {
      await this.cloud.sendText({ ...ctx, text: "Panier vide." });
      return;
    }
    const settings = await this.prisma.orderSettings.findUnique({ where: { tenantId: ctx.tenantId } });
    const fulfillment = session.draft.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP";
    const deliveryFeeXof =
      fulfillment === "DELIVERY" ? (settings?.deliveryFeeXof ?? 0) : 0;
    const subtotalXof = session.cart.reduce((sum, line) => sum + line.priceXof * line.quantity, 0);
    const totalXof = subtotalXof + deliveryFeeXof;
    const customerPhone = `+${ctx.to.replace(/[^\d]/g, "")}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await nextOrderNumber(tx, ctx.tenantId);
      return tx.order.create({
        data: {
          tenantId: ctx.tenantId,
          number,
          fulfillment,
          customerName: session.draft.customerName || "Client WhatsApp",
          customerPhone,
          addressLine: fulfillment === "DELIVERY" ? session.draft.addressLine || null : null,
          city: fulfillment === "DELIVERY" ? session.draft.city || null : null,
          note: "Commande via WhatsApp",
          subtotalXof,
          deliveryFeeXof,
          totalXof,
          currency: ctx.currency,
          paymentMethod: "whatsapp",
          paymentProvider: "NONE",
          paymentStatus: "PENDING",
          status: "PENDING",
          items: {
            create: session.cart.map((line) => ({
              productId: line.productId,
              productName: line.name,
              unitPriceXof: line.priceXof,
              quantity: line.quantity,
              lineTotalXof: line.priceXof * line.quantity,
            })),
          },
          events: {
            create: {
              type: "CREATED",
              toStatus: "PENDING",
              message: "Commande créée depuis WhatsApp",
            },
          },
        },
      });
    });

    await this.proNotifications.notifyOrderCreated({
      tenantId: ctx.tenantId,
      number: created.number,
      customerName: created.customerName,
      totalXof: created.totalXof,
      paymentMethod: "whatsapp",
      paymentStatus: "PENDING",
      createdAt: created.createdAt,
    });

    session.cart = [];
    session.draft = {};
    session.state = "menu";
    await this.saveSession(session);

    await this.cloud.sendText({
      ...ctx,
      text: `✅ Commande ${created.number} enregistrée chez ${ctx.shop}.\nTotal : ${formatXof(totalXof)}.\nLa boutique vous recontacte pour le paiement et la suite.`,
    });
    await this.sendMenu(ctx, session);
  }

  private async loadSession(tenantId: string, waId: string): Promise<Session> {
    const row = await this.prisma.whatsAppChatSession.findUnique({
      where: { tenantId_waId: { tenantId, waId } },
    });
    if (!row) {
      return { tenantId, waId, state: "menu", cart: [], draft: {}, id: null };
    }
    return {
      id: row.id,
      tenantId,
      waId,
      state: row.state,
      cart: parseCart(row.cartJson),
      draft: parseDraft(row.draftJson),
    };
  }

  private async saveSession(session: Session) {
    const data = {
      state: session.state,
      cartJson: session.cart as unknown as Prisma.InputJsonValue,
      draftJson: session.draft as unknown as Prisma.InputJsonValue,
    };
    if (session.id) {
      await this.prisma.whatsAppChatSession.update({ where: { id: session.id }, data });
      return;
    }
    const created = await this.prisma.whatsAppChatSession.create({
      data: {
        tenantId: session.tenantId,
        waId: session.waId,
        ...data,
      },
    });
    session.id = created.id;
  }
}

type Session = {
  id: string | null;
  tenantId: string;
  waId: string;
  state: string;
  cart: CartLine[];
  draft: Draft;
};

function parseCart(value: Prisma.JsonValue): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.productId !== "string" || typeof row.name !== "string") return null;
      return {
        productId: row.productId,
        name: row.name,
        priceXof: Number(row.priceXof) || 0,
        quantity: Number(row.quantity) || 1,
      };
    })
    .filter((item): item is CartLine => Boolean(item));
}

function parseDraft(value: Prisma.JsonValue): Draft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Draft;
}

function isGreeting(value: string) {
  const v = value.toLowerCase();
  return ["bonjour", "bonsoir", "salut", "hello", "hi", "hey", "start", "demarrer", "démarrer"].includes(v);
}

function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

async function nextOrderNumber(tx: Prisma.TransactionClient, tenantId: string) {
  const count = await tx.order.count({ where: { tenantId } });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const number = formatOrderNumber(count + attempt);
    const taken = await tx.order.findUnique({
      where: { tenantId_number: { tenantId, number } },
      select: { id: true },
    });
    if (!taken) return number;
  }
  return formatOrderNumber(Date.now() % 100_000);
}
