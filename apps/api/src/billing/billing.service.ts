import { Injectable, StreamableFile } from "@nestjs/common";
import type { BillingInterval, Plan, PlanOption, PlanPrice } from "@prisma/client";
import { API_ERROR_CODES, addBillingInterval, subscriptionAccess } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { CatalogService } from "../catalog/catalog.service";
import { ModulesService } from "../modules/modules.service";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentsStorage } from "../professionals/documents.storage";
import { TenantAccessService } from "../professionals/tenant-access.service";
import type {
  AssignSubscriptionDto,
  ChangePlanDto,
  DeclarePaymentDto,
  RecordPaymentDto,
  RenewSubscriptionDto,
  UpdatePaymentStatusDto,
  UpdateSubscriptionPeriodDto,
} from "./dto/billing.dto";
import { presentSubscription, subscriptionInclude, type SubscriptionRecord } from "./billing.presenter";

const ALLOWED_RECEIPT = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type PlanWithPrices = Plan & { prices: PlanPrice[]; options: PlanOption[] };

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly access: TenantAccessService,
    private readonly storage: DocumentsStorage,
    private readonly notifications: ProNotificationsService,
    private readonly modules: ModulesService,
  ) {}

  /** Vue admin Abonnements — KPI uniquement sur paiements VALIDATED / retards réels. */
  async listAdminSubscriptions() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [tenants, monthPaid, prevMonthPaid, pendingPayments] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { status: { not: "ARCHIVED" } },
        include: {
          plan: { include: { prices: true } },
          selectedOptions: { include: { option: true } },
          modules: { include: { module: true } },
          subscriptions: {
            include: {
              plan: { include: { prices: true } },
              payments: { orderBy: { createdAt: "desc" }, take: 5 },
            },
            orderBy: { startedAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: "VALIDATED", paidAt: { gte: startOfMonth } },
        _sum: { amountXof: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: "VALIDATED", paidAt: { gte: startPrevMonth, lt: startOfMonth } },
        _sum: { amountXof: true },
      }),
      this.prisma.subscriptionPayment.findMany({
        where: { status: "PENDING" },
        select: { amountXof: true, subscriptionId: true },
      }),
    ]);

    const pendingBySub = new Map<string, number>();
    for (const payment of pendingPayments) {
      pendingBySub.set(
        payment.subscriptionId,
        (pendingBySub.get(payment.subscriptionId) ?? 0) + payment.amountXof,
      );
    }

    const items = tenants.map((tenant) => {
      const active = tenant.subscriptions.find((row) => row.status === "ACTIVE") ?? null;
      const latest = tenant.subscriptions[0] ?? null;
      const plan = active?.plan ?? tenant.plan;
      const interval = active?.interval ?? tenant.planInterval;
      const price =
        plan?.prices.find((item) => item.interval === interval && item.isActive)?.amountXof ?? 0;
      const optionsXof = tenant.selectedOptions.reduce((sum, row) => sum + row.option.amountXof, 0);
      const modulesMonthlyXof = tenant.modules.reduce(
        (sum, row) => sum + (row.module.isActive ? row.module.amountXof : 0),
        0,
      );
      const modulesXof = interval === "YEARLY" ? modulesMonthlyXof * 12 : modulesMonthlyXof;
      const amountXof = price + optionsXof + modulesXof;
      const pendingXof = active ? pendingBySub.get(active.id) ?? 0 : 0;
      const endsAt = active?.currentPeriodEndsAt ?? null;
      const access = endsAt ? subscriptionAccess(endsAt, active?.graceDays ?? 7, now) : null;

      let uiStatus: "active" | "trial" | "late" | "cancelled" | "none" = "none";
      if (active) {
        if (pendingXof > 0 || access === "EXPIRED" || access === "GRACE") {
          uiStatus = "late";
        } else {
          uiStatus = "active";
        }
      } else if (latest?.status === "SUPERSEDED") {
        uiStatus = "cancelled";
      }

      const planTier = planTierLabel(plan?.name ?? "");
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        category: tenant.category,
        subscriptionId: active?.id ?? latest?.id ?? null,
        planId: plan?.id ?? null,
        planName: plan?.name ?? "—",
        planTier,
        interval,
        intervalLabel: interval === "YEARLY" ? "Annuel" : "Mensuel",
        amountXof,
        amountLabel: amountXof <= 0 ? "Gratuit" : null,
        nextDueAt: endsAt?.toISOString() ?? null,
        status: uiStatus,
        statusLabel: statusLabel(uiStatus),
        pendingXof,
        hasValidatedPayment: Boolean(
          active?.payments.some((payment) => payment.status === "VALIDATED") ||
            latest?.payments.some((payment) => payment.status === "VALIDATED"),
        ),
      };
    });

    const mrrXof = monthPaid._sum.amountXof ?? 0;
    const prevMrrXof = prevMonthPaid._sum.amountXof ?? 0;
    const mrrDeltaPct =
      prevMrrXof > 0
        ? Math.round(((mrrXof - prevMrrXof) / prevMrrXof) * 1000) / 10
        : mrrXof > 0
          ? 100
          : null;

    const lateItems = items.filter((item) => item.status === "late");
    const lateXof =
      pendingPayments.reduce((sum, row) => sum + row.amountXof, 0) ||
      lateItems.reduce((sum, item) => sum + item.amountXof, 0);

    return {
      kpis: {
        mrrXof,
        mrrDeltaPct,
        payingCount: items.filter((item) => item.status === "active" && item.amountXof > 0).length,
        // Pas de modèle « essai » en base pour l’instant.
        trialCount: 0,
        lateCount: lateItems.length,
        lateXof,
        previousMonthLabel: startPrevMonth.toLocaleDateString("fr-FR", { month: "long" }),
      },
      plans: await this.listAssignablePlans(),
      items,
    };
  }

  /** Change d’offre admin — met à jour le plan sans inventer de paiement. */
  async changePlan(tenantId: string, input: ChangePlanDto) {
    const tenant = await this.requireTenant(tenantId);
    const plan = await this.catalog.requirePlan(input.planId, tenant.category);
    const interval = input.interval ?? tenant.planInterval;
    if (!plan.prices.some((price) => price.interval === interval && price.isActive)) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Aucun tarif actif pour cet intervalle");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { planId: plan.id, planInterval: interval },
      });
      const active = await tx.subscription.findFirst({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
      });
      if (active) {
        await tx.subscription.update({
          where: { id: active.id },
          data: { planId: plan.id, interval },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: active.id,
            type: "PERIOD",
            message: `Offre modifiée → ${plan.name} (${interval === "YEARLY" ? "annuel" : "mensuel"})`,
          },
        });
      }
    });

    return this.listAdminSubscriptions();
  }

  async giftMonth(tenantId: string) {
    const subscription = await this.requireActive(tenantId);
    const period = this.openPeriod(subscription);
    const endsAt = addBillingInterval(subscription.currentPeriodEndsAt, "MONTHLY");
    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionPeriod.update({
        where: { id: period.id },
        data: { endsAt },
      });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { currentPeriodEndsAt: endsAt },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: "PERIOD",
          message: `+1 mois offert · échéance ${endsAt.toISOString().slice(0, 10)}`,
        },
      });
    });
    return this.listAdminSubscriptions();
  }

  async cancelSubscription(tenantId: string) {
    const subscription = await this.requireActive(tenantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: "SUPERSEDED" },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: "PERIOD",
          message: "Abonnement résilié par l’administration",
        },
      });
    });
    return this.listAdminSubscriptions();
  }

  async remindSubscription(tenantId: string, _staffUserId: string) {
    const subscription = await this.requireActive(tenantId);
    const tenant = await this.requireTenant(tenantId);
    await this.notifications.notify({
      tenantId,
      kind: "SUBSCRIPTION",
      title: "Rappel d’abonnement",
      body: `Votre offre ${subscription.plan.name} arrive à échéance le ${subscription.currentPeriodEndsAt
        .toISOString()
        .slice(0, 10)}.`,
      href: "/abonnement",
      dedupeKey: `subscription:remind:${subscription.id}:${new Date().toISOString().slice(0, 10)}`,
    });
    return { sent: true, tenantName: tenant.name };
  }

  private async listAssignablePlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { prices: { where: { isActive: true } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      category: plan.category,
      tier: planTierLabel(plan.name),
      prices: plan.prices.map((price) => ({
        interval: price.interval,
        amountXof: price.amountXof,
      })),
    }));
  }

  async currentForStaff(tenantId: string) {
    await this.requireTenant(tenantId);
    return this.presentCurrent(tenantId, "staff");
  }

  async historyForStaff(tenantId: string) {
    await this.requireTenant(tenantId);
    return this.presentHistory(tenantId, "staff");
  }

  async currentForMember(userId: string, tenantId: string) {
    await this.access.getWorkspaceForMember(userId, tenantId);
    return this.presentCurrent(tenantId, "pro");
  }

  async historyForMember(userId: string, tenantId: string) {
    await this.access.getWorkspaceForMember(userId, tenantId);
    return this.presentHistory(tenantId, "pro");
  }

  /** Vue complète page Abonnement (espace pro). */
  async overviewForMember(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      include: {
        ...subscriptionInclude,
        plan: {
          include: {
            prices: { where: { isActive: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const plans = await this.catalog.listPlans(tenant.category, true);
    const modulesPayload = await this.modules.listForWorkspace(userId, tenantId);
    const currentPlanId = subscription?.planId ?? tenant.planId;
    const interval = subscription?.interval ?? tenant.planInterval;
    const currentPlan = plans.find((plan) => plan.id === currentPlanId) ?? null;
    const monthlyXof =
      currentPlan?.prices.find((price) => price.interval === "MONTHLY" && price.isActive)?.amountXof ?? 0;
    const periodAmountXof =
      currentPlan?.prices.find((price) => price.interval === interval && price.isActive)?.amountXof ?? monthlyXof;
    const modulesMonthlyXof = await this.modules.monthlyModulesAmount(tenantId);
    const modulesPeriodXof = interval === "YEARLY" ? modulesMonthlyXof * 12 : modulesMonthlyXof;
    const catalogLabel = tenant.category === "RESTAURANT" ? "Plats" : "Produits";
    const hasCommerce = tenant.category === "BOUTIQUE" || tenant.category === "RESTAURANT";

    const access = subscription
      ? subscriptionAccess(subscription.currentPeriodEndsAt, subscription.graceDays)
      : "EXPIRED";

    const payments = (subscription?.payments ?? [])
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((payment) => ({
        id: payment.id,
        label: paymentLabel(payment.reference, subscription?.plan.name ?? currentPlan?.name ?? "Abonnement"),
        amountXof: payment.amountXof,
        status: payment.status,
        statusLabel: paymentStatusLabel(payment.status),
        method: payment.method,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      }));

    return {
      current: {
        planId: currentPlanId,
        planName: currentPlan?.name ?? subscription?.plan.name ?? "—",
        planTier: planTierLabel(currentPlan?.name ?? subscription?.plan.name ?? ""),
        interval,
        intervalLabel: interval === "YEARLY" ? "an" : "mois",
        amountXof: periodAmountXof,
        modulesXof: modulesPeriodXof,
        totalXof: periodAmountXof + modulesPeriodXof,
        nextDueAt: subscription?.currentPeriodEndsAt?.toISOString() ?? null,
        access,
        status: subscription?.status ?? null,
        subscriptionId: subscription?.id ?? null,
      },
      plans: plans.map((plan) => {
        const planMonthly =
          plan.prices.find((price) => price.interval === "MONTHLY" && price.isActive)?.amountXof ?? 0;
        const tier = planTierKey(plan.name, plan.slug);
        return {
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          tier,
          featured: tier === "pro",
          monthlyXof: planMonthly,
          commissionPct: hasCommerce ? plan.commissionPct : null,
          maxCatalogItems: hasCommerce ? plan.maxCatalogItems : null,
          maxCollaborators: plan.maxCollaborators,
          includesPremiumTemplates: plan.includesPremiumTemplates,
          isCurrent: plan.id === currentPlanId,
          highlights: planHighlights({
            tier,
            hasCommerce,
            catalogLabel,
            commissionPct: plan.commissionPct,
            maxCatalogItems: plan.maxCatalogItems,
            maxCollaborators: plan.maxCollaborators,
            includesPremiumTemplates: plan.includesPremiumTemplates,
          }),
          ctaLabel:
            plan.id === currentPlanId
              ? "Offre actuelle"
              : planMonthly <= 0
                ? "Revenir à Découverte"
                : `Passer à ${plan.name.replace(/^Offre\s+/i, "")}`,
        };
      }),
      options: modulesPayload.items.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        amountXof: item.amountXof,
        intervalLabel: "mois",
        activated: item.activated,
        statusLabel: item.activated ? "Activé" : "Désactivé",
      })),
      payments,
    };
  }

  async changePlanForMember(userId: string, tenantId: string, input: ChangePlanDto) {
    await this.access.getWorkspaceForMember(userId, tenantId, { owner: true });
    await this.changePlan(tenantId, input);
    return this.overviewForMember(userId, tenantId);
  }

  async renewForMember(userId: string, tenantId: string, input: DeclarePaymentDto) {
    await this.declarePayment(userId, tenantId, input);
    return this.overviewForMember(userId, tenantId);
  }

  async assign(tenantId: string, input: AssignSubscriptionDto, userId: string) {
    const tenant = await this.requireTenant(tenantId);
    const plan = await this.catalog.requirePlan(input.planId, tenant.category);
    const options = input.optionIds ? await this.catalog.requireOptions(input.optionIds, plan.id) : [];
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    const endsAt = addBillingInterval(startedAt, input.interval);
    if (endsAt.getTime() <= startedAt.getTime()) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "La date d'échéance doit être après le début");
    }
    const modulesXof = await this.modulesAmountForInterval(tenantId, input.interval);
    const amountXof = this.amountFor(plan, input.interval, options) + modulesXof;
    const graceDays = input.graceDays ?? plan.graceDays;
    const expiredRestriction = input.expiredRestriction ?? plan.expiredRestriction;

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { tenantId, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });
      await tx.tenantPlanOption.deleteMany({ where: { tenantId } });
      if (options.length > 0) {
        await tx.tenantPlanOption.createMany({
          data: options.map((option) => ({ tenantId, optionId: option.id })),
        });
      }
      await tx.tenant.update({
        where: { id: tenantId },
        data: { planId: plan.id, planInterval: input.interval },
      });
      const subscription = await tx.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          interval: input.interval,
          graceDays,
          expiredRestriction,
          startedAt,
          currentPeriodEndsAt: endsAt,
          periods: { create: { sequence: 1, startedAt, endsAt } },
          events: { create: { type: "CREATED", message: `Offre ${plan.name} associée` } },
        },
        include: { periods: true },
      });
      const period = subscription.periods[0];
      if (!period) {
        throw new ApiException(API_ERROR_CODES.INTERNAL_ERROR);
      }
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          periodId: period.id,
          amountXof,
          status: input.paymentStatus ?? "PENDING",
          method: input.method ?? "OTHER",
          reference: input.reference,
          paidAt: input.paymentStatus === "VALIDATED" ? new Date() : null,
          recordedByUserId: userId,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: "PAYMENT",
          message: `Paiement de ${amountXof} XOF enregistré`,
        },
      });
      return subscription.id;
    });

    return this.presentById(created, tenantId, "staff");
  }

  async updatePeriod(tenantId: string, input: UpdateSubscriptionPeriodDto) {
    const subscription = await this.requireActive(tenantId);
    const period = this.openPeriod(subscription);
    const startedAt = input.startedAt ? new Date(input.startedAt) : period.startedAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : period.endsAt;
    if (endsAt.getTime() <= startedAt.getTime()) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "La date d'échéance doit être après le début");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionPeriod.update({
        where: { id: period.id },
        data: { startedAt, endsAt },
      });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          startedAt: period.sequence === 1 ? startedAt : subscription.startedAt,
          currentPeriodEndsAt: endsAt,
          graceDays: input.graceDays,
          expiredRestriction: input.expiredRestriction,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: "PERIOD",
          message: "Période, grâce ou restriction mises à jour",
        },
      });
    });
    return this.presentById(subscription.id, tenantId, "staff");
  }

  async renew(tenantId: string, input: RenewSubscriptionDto, userId: string) {
    const subscription = await this.requireActive(tenantId);
    const plan = await this.catalog.requirePlan(subscription.planId, subscription.plan.category);
    const options = await this.prisma.planOption.findMany({
      where: { tenants: { some: { tenantId } }, planId: plan.id, isActive: true },
    });
    const startedAt =
      subscription.currentPeriodEndsAt.getTime() > Date.now() ? subscription.currentPeriodEndsAt : new Date();
    const endsAt = addBillingInterval(startedAt, subscription.interval);
    const modulesXof = await this.modulesAmountForInterval(tenantId, subscription.interval);
    const amountXof = this.amountFor(plan, subscription.interval, options) + modulesXof;
    const sequence = subscription.periods.reduce((max, period) => Math.max(max, period.sequence), 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      const period = await tx.subscriptionPeriod.create({
        data: { subscriptionId: subscription.id, sequence, startedAt, endsAt },
      });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { currentPeriodEndsAt: endsAt },
      });
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          periodId: period.id,
          amountXof,
          status: input.paymentStatus ?? "PENDING",
          method: input.method ?? "OTHER",
          reference: input.reference,
          paidAt: input.paymentStatus === "VALIDATED" ? new Date() : null,
          recordedByUserId: userId,
        },
      });
      await tx.subscriptionEvent.create({
        data: { subscriptionId: subscription.id, type: "RENEWED", message: `Renouvellement jusqu'au ${endsAt.toISOString().slice(0, 10)}` },
      });
    });
    return this.presentById(subscription.id, tenantId, "staff");
  }

  async recordPayment(tenantId: string, input: RecordPaymentDto, userId: string) {
    const subscription = await this.requireActive(tenantId);
    const period = this.openPeriod(subscription);
    const amountXof = input.amountXof ?? (await this.currentAmount(tenantId, subscription));
    await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        periodId: period.id,
        amountXof,
        status: input.status ?? "PENDING",
        method: input.method ?? "OTHER",
        reference: input.reference,
        paidAt: input.status === "VALIDATED" ? new Date() : null,
        recordedByUserId: userId,
      },
    });
    await this.prisma.subscriptionEvent.create({
      data: { subscriptionId: subscription.id, type: "PAYMENT", message: `Paiement ${input.status ?? "PENDING"} de ${amountXof} XOF` },
    });
    return this.presentById(subscription.id, tenantId, "staff");
  }

  async declarePayment(userId: string, tenantId: string, input: DeclarePaymentDto) {
    await this.access.getWorkspaceForMember(userId, tenantId, { owner: true });
    const subscription = await this.requireActive(tenantId);
    const period = this.openPeriod(subscription);
    const amountXof = await this.currentAmount(tenantId, subscription);
    await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        periodId: period.id,
        amountXof,
        status: "PENDING",
        method: input.method ?? "OTHER",
        reference: input.reference,
        recordedByUserId: userId,
      },
    });
    await this.prisma.subscriptionEvent.create({
      data: { subscriptionId: subscription.id, type: "PAYMENT", message: "Paiement déclaré par le professionnel" },
    });
    return this.presentById(subscription.id, tenantId, "pro");
  }

  async setPaymentStatus(tenantId: string, paymentId: string, input: UpdatePaymentStatusDto) {
    const subscription = await this.requireActive(tenantId);
    const payment = subscription.payments.find((item) => item.id === paymentId);
    if (!payment) {
      throw new ApiException(API_ERROR_CODES.PAYMENT_NOT_FOUND);
    }
    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: input.status,
        failureReason: input.status === "FAILED" ? (input.failureReason ?? payment.failureReason) : null,
        paidAt: input.status === "VALIDATED" ? (payment.paidAt ?? new Date()) : null,
      },
    });
    await this.prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: "PAYMENT",
        message: `Paiement ${payment.amountXof} XOF : ${input.status}`,
      },
    });
    return this.presentById(subscription.id, tenantId, "staff");
  }

  async addReceipt(
    tenantId: string,
    paymentId: string,
    file: Express.Multer.File,
    audience: "staff" | "pro",
    userId?: string,
  ) {
    if (audience === "pro") {
      if (!userId) {
        throw new ApiException(API_ERROR_CODES.FORBIDDEN);
      }
      await this.access.getWorkspaceForMember(userId, tenantId, { owner: true });
    } else {
      await this.requireTenant(tenantId);
    }
    if (!ALLOWED_RECEIPT.has(file.mimetype)) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Le justificatif doit être un PDF ou une image");
    }
    const subscription = await this.requireActive(tenantId);
    const payment = subscription.payments.find((item) => item.id === paymentId);
    if (!payment) {
      throw new ApiException(API_ERROR_CODES.PAYMENT_NOT_FOUND);
    }
    const receipt = await this.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        originalName: file.originalname || "justificatif",
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "pending",
      },
    });
    const storageKey = `receipts/${this.storage.key(tenantId, receipt.id, receipt.originalName)}`;
    await this.storage.save(storageKey, file.buffer);
    await this.prisma.paymentReceipt.update({ where: { id: receipt.id }, data: { storageKey } });
    await this.prisma.subscriptionEvent.create({
      data: { subscriptionId: subscription.id, type: "RECEIPT", message: "Justificatif ajouté" },
    });
    return this.presentById(subscription.id, tenantId, audience);
  }

  async downloadReceipt(tenantId: string, paymentId: string, receiptId: string, userId?: string) {
    if (userId) {
      await this.access.getWorkspaceForMember(userId, tenantId);
    } else {
      await this.requireTenant(tenantId);
    }
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: { id: receiptId, paymentId, payment: { subscription: { tenantId } } },
    });
    if (!receipt || receipt.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.RECEIPT_NOT_FOUND);
    }
    return new StreamableFile(this.storage.stream(receipt.storageKey), {
      type: receipt.mimeType,
      disposition: `inline; filename="${receipt.originalName.replaceAll('"', "")}"`,
    });
  }

  private async presentCurrent(tenantId: string, audience: "staff" | "pro") {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      include: subscriptionInclude,
      orderBy: { startedAt: "desc" },
    });
    if (!subscription) {
      throw new ApiException(API_ERROR_CODES.SUBSCRIPTION_NOT_FOUND);
    }
    return presentSubscription(subscription, (paymentId, receiptId) => this.receiptUrl(audience, tenantId, paymentId, receiptId));
  }

  private async presentHistory(tenantId: string, audience: "staff" | "pro") {
    const rows = await this.prisma.subscription.findMany({
      where: { tenantId },
      include: subscriptionInclude,
      orderBy: { startedAt: "desc" },
    });
    return rows.map((row) =>
      presentSubscription(row, (paymentId, receiptId) => this.receiptUrl(audience, tenantId, paymentId, receiptId)),
    );
  }

  private async presentById(id: string, tenantId: string, audience: "staff" | "pro") {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, tenantId },
      include: subscriptionInclude,
    });
    if (!subscription) {
      throw new ApiException(API_ERROR_CODES.SUBSCRIPTION_NOT_FOUND);
    }
    return presentSubscription(subscription, (paymentId, receiptId) => this.receiptUrl(audience, tenantId, paymentId, receiptId));
  }

  private async requireActive(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      include: subscriptionInclude,
      orderBy: { startedAt: "desc" },
    });
    if (!subscription) {
      throw new ApiException(API_ERROR_CODES.SUBSCRIPTION_NOT_FOUND);
    }
    return subscription;
  }

  private openPeriod(subscription: SubscriptionRecord) {
    const period = [...subscription.periods].sort((a, b) => b.sequence - a.sequence)[0];
    if (!period) {
      throw new ApiException(API_ERROR_CODES.SUBSCRIPTION_NOT_FOUND, "Aucune période ouverte");
    }
    return period;
  }

  private async currentAmount(tenantId: string, subscription: SubscriptionRecord) {
    const plan = await this.catalog.requirePlan(subscription.planId, subscription.plan.category);
    const options = await this.prisma.planOption.findMany({
      where: { tenants: { some: { tenantId } }, planId: plan.id, isActive: true },
    });
    const modulesXof = await this.modulesAmountForInterval(tenantId, subscription.interval);
    return this.amountFor(plan, subscription.interval, options) + modulesXof;
  }

  private async modulesAmountForInterval(tenantId: string, interval: BillingInterval) {
    const monthly = await this.modules.monthlyModulesAmount(tenantId);
    return interval === "YEARLY" ? monthly * 12 : monthly;
  }

  private amountFor(plan: PlanWithPrices, interval: BillingInterval, options: Array<{ amountXof: number }>) {
    const price = plan.prices.find((item) => item.interval === interval && item.isActive);
    if (!price) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Aucun tarif actif pour cet intervalle");
    }
    return price.amountXof + options.reduce((sum, option) => sum + option.amountXof, 0);
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }
    return tenant;
  }

  private receiptUrl(audience: "staff" | "pro", tenantId: string, paymentId: string, receiptId: string) {
    if (audience === "staff") {
      return `/api/admin/tenants/${tenantId}/subscription/payments/${paymentId}/receipts/${receiptId}/file`;
    }
    return `/api/workspaces/${tenantId}/subscription/payments/${paymentId}/receipts/${receiptId}/file`;
  }
}

function planTierLabel(planName: string) {
  const lower = planName.toLowerCase();
  if (lower.includes("business")) return "Business";
  if (lower.includes("pro")) return "Pro";
  if (lower.includes("starter") || lower.includes("découverte") || lower.includes("decouverte")) {
    return "Découverte";
  }
  return planName || "—";
}

function planTierKey(name: string, slug: string): "decouverte" | "pro" | "business" | null {
  const hay = `${name} ${slug}`.toLowerCase();
  if (hay.includes("business")) return "business";
  if (
    hay.includes("découverte") ||
    hay.includes("decouverte") ||
    hay.includes("starter") ||
    /(^|-)discovery($|-)/.test(hay)
  ) {
    return "decouverte";
  }
  if (/\bpro\b/.test(hay) || hay.includes("-pro") || hay.endsWith("pro")) return "pro";
  return null;
}

function planHighlights(input: {
  tier: "decouverte" | "pro" | "business" | null;
  hasCommerce: boolean;
  catalogLabel: string;
  commissionPct: number | null;
  maxCatalogItems: number | null;
  maxCollaborators: number;
  includesPremiumTemplates: boolean;
}) {
  const lines: string[] = [];
  if (input.tier === "decouverte") {
    lines.push("Site vitrine inclus");
    if (input.hasCommerce) {
      lines.push(
        input.maxCatalogItems == null
          ? `${input.catalogLabel} illimités`
          : `Jusqu'à ${input.maxCatalogItems} ${input.catalogLabel.toLowerCase()}`,
      );
      lines.push(
        `Commission ${input.commissionPct == null ? "—" : `${String(input.commissionPct).replace(".", ",")} %`}`,
      );
    }
    lines.push("Support e-mail");
    return lines;
  }
  if (input.tier === "pro") {
    lines.push("Domaine personnalisé");
    if (input.includesPremiumTemplates) lines.push("-50 % modèles premium");
    if (input.hasCommerce && input.commissionPct != null) {
      lines.push(`Commission ${String(input.commissionPct).replace(".", ",")} %`);
    }
    lines.push("Stats avancées");
    return lines;
  }
  if (input.tier === "business") {
    lines.push("Tout Pro inclus");
    if (input.hasCommerce && input.commissionPct != null) {
      lines.push(`Commission ${String(input.commissionPct).replace(".", ",")} %`);
    }
    lines.push(
      `Multi-utilisateurs (${input.maxCollaborators})`,
    );
    lines.push("Support prioritaire");
    return lines;
  }
  if (input.hasCommerce) {
    if (input.commissionPct != null) {
      lines.push(`Commission ${String(input.commissionPct).replace(".", ",")} %`);
    }
    lines.push(
      input.maxCatalogItems == null
        ? `${input.catalogLabel} illimités`
        : `${input.maxCatalogItems} ${input.catalogLabel.toLowerCase()}`,
    );
  }
  lines.push(
    `${input.maxCollaborators} collaborateur${input.maxCollaborators > 1 ? "s" : ""}`,
  );
  return lines;
}

function paymentStatusLabel(status: string) {
  if (status === "VALIDATED") return "Payé";
  if (status === "PENDING") return "En attente";
  if (status === "FAILED") return "Échoué";
  return status;
}

function paymentLabel(reference: string | null, planName: string) {
  if (reference === "OFFRE_GRATUITE") return `Offre gratuite ${planName}`;
  if (reference?.toLowerCase().includes("domaine")) return "Nom de domaine (1 an)";
  return `Abonnement ${planName.replace(/^Offre\s+/i, "")}`;
}

function statusLabel(status: "active" | "trial" | "late" | "cancelled" | "none") {
  if (status === "active") return "Actif";
  if (status === "late") return "En retard";
  if (status === "trial") return "Essai";
  if (status === "cancelled") return "Résilié";
  return "Sans abonnement";
}
