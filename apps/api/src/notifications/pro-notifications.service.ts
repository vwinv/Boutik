import { Injectable, Logger } from "@nestjs/common";
import type { ProNotificationKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CreateInput = {
  tenantId: string;
  kind: ProNotificationKind;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey?: string | null;
  createdAt?: Date;
};

@Injectable()
export class ProNotificationsService {
  private readonly logger = new Logger(ProNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: CreateInput) {
    try {
      await this.prisma.proNotification.create({
        data: {
          tenantId: input.tenantId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          href: input.href ?? null,
          dedupeKey: input.dedupeKey ?? null,
          createdAt: input.createdAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      this.logger.warn(`Notification non créée: ${error instanceof Error ? error.message : "erreur"}`);
    }
  }

  async notifyOrderCreated(order: {
    tenantId: string;
    number: string;
    customerName: string;
    totalXof: number;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    createdAt?: Date;
  }) {
    const pay =
      order.paymentStatus === "PAID"
        ? ` · payée${order.paymentMethod ? ` par ${paymentLabel(order.paymentMethod)}` : ""}`
        : order.paymentStatus === "COD" || order.paymentMethod === "cod"
          ? " · paiement à la livraison"
          : order.paymentMethod === "whatsapp"
            ? " · via WhatsApp"
            : "";
    await this.notify({
      tenantId: order.tenantId,
      kind: "ORDERS",
      title: `Nouvelle commande ${order.number}`,
      body: `${order.customerName} · ${formatXof(order.totalXof)}${pay}`,
      href: "/commandes",
      dedupeKey: `order:created:${order.number}`,
      createdAt: order.createdAt,
    });
  }

  async notifyPaymentReceived(order: {
    tenantId: string;
    number: string;
    totalXof: number;
    paymentMethod?: string | null;
  }) {
    await this.notify({
      tenantId: order.tenantId,
      kind: "PAYMENTS",
      title: "Paiement reçu",
      body: `${order.number} · ${formatXof(order.totalXof)}${
        order.paymentMethod ? ` via ${paymentLabel(order.paymentMethod)}` : ""
      }`,
      href: "/commandes",
      dedupeKey: `order:paid:${order.number}`,
    });
  }

  async notifyWithdrawal(input: {
    tenantId: string;
    amountXof: number;
    destination: string;
    withdrawalId: string;
  }) {
    await this.notify({
      tenantId: input.tenantId,
      kind: "WITHDRAWALS",
      title: "Demande de retrait envoyée",
      body: `${formatXof(input.amountXof)} vers ${input.destination} · en attente de validation BoutiK`,
      href: "/wallet",
      dedupeKey: `withdrawal:${input.withdrawalId}`,
    });
  }

  async notifySubscriptionStarted(input: {
    tenantId: string;
    planName: string;
    endsAt: Date;
    subscriptionId: string;
    free: boolean;
  }) {
    const until = formatFrDate(input.endsAt);
    await this.notify({
      tenantId: input.tenantId,
      kind: "SUBSCRIPTION",
      title: input.free ? `Offre gratuite ${input.planName} activée` : `Offre ${input.planName} activée`,
      body: input.free
        ? `Votre offre gratuite ${input.planName} est active jusqu’au ${until}. Consultez votre abonnement pour les détails.`
        : `Votre offre ${input.planName} est active jusqu’au ${until}.`,
      href: "/abonnement",
      dedupeKey: `subscription:started:${input.subscriptionId}`,
    });
  }

  async notifySubscriptionExpired(input: {
    tenantId: string;
    planName: string;
    endsAt: Date;
    subscriptionId: string;
    free: boolean;
  }) {
    const when = formatFrDate(input.endsAt);
    await this.notify({
      tenantId: input.tenantId,
      kind: "SUBSCRIPTION",
      title: input.free ? `Offre gratuite ${input.planName} expirée` : `Offre ${input.planName} expirée`,
      body: input.free
        ? `Votre offre gratuite a pris fin le ${when}. Passez à une offre payante pour continuer sans restriction.`
        : `Votre offre ${input.planName} a pris fin le ${when}. Renouvelez pour retrouver l’accès complet.`,
      href: "/abonnement",
      dedupeKey: `subscription:expired:${input.subscriptionId}`,
    });
  }

  async listForTenant(tenantId: string) {
    await this.backfillFromOrders(tenantId);
    const rows = await this.prisma.proNotification.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    const unreadCount = rows.filter((row) => !row.readAt).length;
    return {
      unreadCount,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        href: row.href,
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async markRead(tenantId: string, notificationId: string) {
    await this.prisma.proNotification.updateMany({
      where: { id: notificationId, tenantId, archivedAt: null },
      data: { readAt: new Date() },
    });
    return this.listForTenant(tenantId);
  }

  async markAllRead(tenantId: string) {
    await this.prisma.proNotification.updateMany({
      where: { tenantId, archivedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return this.listForTenant(tenantId);
  }

  async archive(tenantId: string, notificationId: string) {
    await this.prisma.proNotification.updateMany({
      where: { id: notificationId, tenantId },
      data: { archivedAt: new Date(), readAt: new Date() },
    });
    return this.listForTenant(tenantId);
  }

  async unreadCount(tenantId: string) {
    await this.backfillFromOrders(tenantId);
    return this.prisma.proNotification.count({
      where: { tenantId, archivedAt: null, readAt: null },
    });
  }

  /** Rattrapage unique : crée des notifs à partir des commandes existantes. */
  private async backfillFromOrders(tenantId: string) {
    const existing = await this.prisma.proNotification.count({ where: { tenantId } });
    if (existing > 0) return;

    const orders = await this.prisma.order.findMany({
      where: { tenantId, status: { not: "CANCELLED" } },
      select: {
        number: true,
        customerName: true,
        totalXof: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    for (const order of orders) {
      await this.notifyOrderCreated({ tenantId, ...order });
      if (order.paymentStatus === "PAID") {
        await this.notifyPaymentReceived({
          tenantId,
          number: order.number,
          totalXof: order.totalXof,
          paymentMethod: order.paymentMethod,
        });
      }
    }

    const withdrawals = await this.prisma.walletWithdrawal.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    for (const row of withdrawals) {
      await this.notifyWithdrawal({
        tenantId,
        amountXof: row.amountXof,
        destination: row.destination,
        withdrawalId: row.id,
      });
    }
  }
}

function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

function formatFrDate(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function paymentLabel(method: string) {
  const key = method.toLowerCase();
  if (key === "wave") return "Wave";
  if (key === "orange") return "Orange Money";
  if (key === "mtn") return "MTN MoMo";
  if (key === "card") return "Carte";
  if (key === "cod") return "COD";
  if (key === "whatsapp") return "WhatsApp";
  return method;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
