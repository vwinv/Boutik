import { Injectable, Logger } from "@nestjs/common";
import { addBillingInterval } from "@boutik/domain";
import { CatalogService } from "../catalog/catalog.service";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly notifications: ProNotificationsService,
  ) {}

  /**
   * À l’inscription / création d’espace : active l’offre gratuite (plan par défaut)
   * et notifie le professionnel.
   */
  async ensureDefaultFreeSubscription(tenantId: string) {
    const existing = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      await this.notifications.notifySubscriptionStarted({
        tenantId,
        planName: (await this.planName(existing.planId)) ?? "Découverte",
        endsAt: existing.currentPeriodEndsAt,
        subscriptionId: existing.id,
        free: await this.isFreePlan(existing.planId),
      });
      return existing;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: { include: { prices: true } } },
    });
    if (!tenant) return null;

    const plan =
      (tenant.planId
        ? await this.prisma.plan.findFirst({
            where: { id: tenant.planId, isActive: true },
            include: { prices: true },
          })
        : null) ??
      (await this.catalog.defaultPlan(tenant.category)) ??
      (await this.prisma.plan.findFirst({
        where: { category: tenant.category, isActive: true },
        include: { prices: true },
        orderBy: { sortOrder: "asc" },
      }));

    if (!plan) {
      this.logger.warn(`Aucun plan disponible pour le tenant ${tenantId}`);
      return null;
    }

    const interval = tenant.planInterval ?? "MONTHLY";
    const startedAt = new Date();
    const endsAt = addBillingInterval(startedAt, interval);
    const monthly = plan.prices.find((price) => price.interval === "MONTHLY" && price.isActive);
    const amountXof = monthly?.amountXof ?? 0;
    const free = amountXof <= 0;

    const subscription = await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { planId: plan.id, planInterval: interval },
      });
      const created = await tx.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          interval,
          graceDays: plan.graceDays,
          expiredRestriction: plan.expiredRestriction,
          startedAt,
          currentPeriodEndsAt: endsAt,
          periods: { create: { sequence: 1, startedAt, endsAt } },
          events: {
            create: {
              type: "CREATED",
              message: free
                ? `Offre gratuite ${plan.name} activée à l’inscription`
                : `Offre ${plan.name} activée à l’inscription`,
            },
          },
        },
        include: { periods: true },
      });
      const period = created.periods[0];
      if (period) {
        await tx.subscriptionPayment.create({
          data: {
            subscriptionId: created.id,
            periodId: period.id,
            amountXof,
            status: "VALIDATED",
            method: "OTHER",
            reference: free ? "OFFRE_GRATUITE" : "INSCRIPTION",
            paidAt: startedAt,
          },
        });
      }
      return created;
    });

    await this.notifications.notifySubscriptionStarted({
      tenantId,
      planName: plan.name,
      endsAt,
      subscriptionId: subscription.id,
      free,
    });

    return subscription;
  }

  /** Crée la notif d’expiration dès la fin de période (idempotent). */
  async syncExpirationNotification(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      include: { plan: { include: { prices: true } } },
      orderBy: { startedAt: "desc" },
    });
    if (!subscription) return;
    if (new Date() <= subscription.currentPeriodEndsAt) return;

    const free = subscription.plan.prices.some(
      (price) => price.interval === subscription.interval && price.isActive && price.amountXof <= 0,
    );

    await this.notifications.notifySubscriptionExpired({
      tenantId,
      planName: subscription.plan.name,
      endsAt: subscription.currentPeriodEndsAt,
      subscriptionId: subscription.id,
      free,
    });
  }

  private async planName(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId }, select: { name: true } });
    return plan?.name ?? null;
  }

  private async isFreePlan(planId: string) {
    const price = await this.prisma.planPrice.findFirst({
      where: { planId, interval: "MONTHLY", isActive: true },
    });
    return (price?.amountXof ?? 0) <= 0;
  }
}
