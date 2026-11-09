import { Injectable } from "@nestjs/common";
import { BOUTIK_COMMISSION_RATE, boutikCommissionXof } from "@boutik/domain";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const paidSaleFilter = {
      status: { not: "CANCELLED" as const },
      paymentStatus: { in: ["PAID" as const, "COD" as const] },
    };

    const [
      professionalsTotal,
      professionalsMonth,
      sitesActive,
      tenantsByCategory,
      sales30,
      salesPrev30,
      salesMonth,
      pendingWithdrawals,
      openTickets,
      ledgerCredits,
      ledgerDebits,
      monthPaidSubs,
      pendingSubPayments,
      professionalsCreated,
      tenantsTotal,
      creditedSales,
      suspendedTenants,
    ] = await Promise.all([
      this.prisma.professional.count(),
      this.prisma.professional.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.tenant.count({
        where: { status: "ACTIVE", site: { status: "PUBLISHED" } },
      }),
      this.prisma.tenant.groupBy({
        by: ["category"],
        where: { status: { not: "ARCHIVED" } },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: days30 }, ...paidSaleFilter },
        _sum: { totalXof: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: days60, lt: days30 }, ...paidSaleFilter },
        _sum: { totalXof: true },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, ...paidSaleFilter },
        _sum: { totalXof: true },
      }),
      this.prisma.walletWithdrawal.findMany({
        where: { status: "PENDING" },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.supportTicket.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        include: { tenant: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      this.prisma.walletLedgerEntry.aggregate({
        where: { type: "CREDIT", reason: "ORDER_SALE" },
        _sum: { amountXof: true },
      }),
      this.prisma.walletLedgerEntry.aggregate({
        where: { type: "DEBIT", reason: { in: ["WITHDRAWAL", "REFUND"] } },
        _sum: { amountXof: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: {
          status: "VALIDATED",
          paidAt: { gte: startOfMonth },
        },
        _sum: { amountXof: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: "PENDING" },
        _sum: { amountXof: true },
        _count: { _all: true },
      }),
      this.prisma.professional.findMany({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 9, 1),
          },
        },
        select: { createdAt: true },
      }),
      this.prisma.tenant.count({ where: { status: { not: "ARCHIVED" } } }),
      // Ventes réellement créditées au wallet (base unique pour commission + wallet principal).
      this.prisma.order.findMany({
        where: {
          status: { not: "CANCELLED" },
          walletEntries: { some: { type: "CREDIT", reason: "ORDER_SALE" } },
        },
        select: { totalXof: true, paidAt: true, createdAt: true },
      }),
      this.prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    ]);

    const sales30Xof = sales30._sum.totalXof ?? 0;
    const salesPrev30Xof = salesPrev30._sum.totalXof ?? 0;
    const salesMonthXof = salesMonth._sum.totalXof ?? 0;
    const saleDate = (order: { paidAt: Date | null; createdAt: Date }) => order.paidAt ?? order.createdAt;
    const commissionsAllXof = creditedSales.reduce((sum, order) => sum + boutikCommissionXof(order.totalXof), 0);
    const commissions30Xof = creditedSales
      .filter((order) => saleDate(order) >= days30)
      .reduce((sum, order) => sum + boutikCommissionXof(order.totalXof), 0);
    const commissionsMonthXof = creditedSales
      .filter((order) => saleDate(order) >= startOfMonth)
      .reduce((sum, order) => sum + boutikCommissionXof(order.totalXof), 0);
    const sales30DeltaPct =
      salesPrev30Xof > 0
        ? Math.round(((sales30Xof - salesPrev30Xof) / salesPrev30Xof) * 1000) / 10
        : sales30Xof > 0
          ? 100
          : null;

    const pendingWithdrawalsXof = pendingWithdrawals.reduce((sum, row) => sum + row.amountXof, 0);
    const highPriorityTickets = openTickets.filter((ticket) =>
      /bloqué|urgent|refus|panne|critique/i.test(ticket.subject),
    );
    // Uniquement des montants réellement encaissés / en attente (pas de projection tarifaire).
    const subscriptionRevenueMonthXof = monthPaidSubs._sum.amountXof ?? 0;
    const lateRecoverXof = pendingSubPayments._sum.amountXof ?? 0;
    const lateSubscriptionsCount = pendingSubPayments._count._all;

    // Fonds pro = net crédité (95 %) − retraits/remboursements.
    const proFundsXof = Math.max(0, (ledgerCredits._sum.amountXof ?? 0) - (ledgerDebits._sum.amountXof ?? 0));
    const boutikMonthXof = subscriptionRevenueMonthXof + commissionsMonthXof;
    // Wallet principal = argent de la plateforme : part pro + commissions (brut des ventes créditées) + abonnements du mois.
    const mainWalletXof = proFundsXof + commissionsAllXof + subscriptionRevenueMonthXof;

    const categoryTotal = tenantsByCategory.reduce((sum, row) => sum + row._count._all, 0) || 1;
    const categorySplit = (["BOUTIQUE", "RESTAURANT", "VITRINE"] as const).map((code) => {
      const count = tenantsByCategory.find((row) => row.category === code)?._count._all ?? 0;
      return {
        key: code,
        label: code === "BOUTIQUE" ? "Boutique" : code === "RESTAURANT" ? "Restaurant" : "Site vitrine",
        count,
        pct: Math.round((count / categoryTotal) * 100),
      };
    });

    const inscriptions = buildMonthlySeries(professionalsCreated, now);

    const todo = [
      pendingWithdrawals.length > 0
        ? {
            id: "withdrawals",
            tone: "warning" as const,
            label: `${pendingWithdrawals.length} demande${pendingWithdrawals.length > 1 ? "s" : ""} de retrait à valider`,
            sub: `${formatXof(pendingWithdrawalsXof)} · ${pendingWithdrawals
              .slice(0, 2)
              .map((row) => row.tenant.name)
              .join(", ")}`,
            href: "/retraits",
          }
        : null,
      highPriorityTickets.length > 0
        ? {
            id: "tickets-high",
            tone: "danger" as const,
            label: `${highPriorityTickets.length} ticket${highPriorityTickets.length > 1 ? "s" : ""} priorité haute`,
            sub: highPriorityTickets
              .slice(0, 2)
              .map((ticket) => `${ticket.tenant.name} — ${ticket.subject}`)
              .join(" · "),
            href: "/support",
          }
        : openTickets.length > 0
          ? {
              id: "tickets",
              tone: "danger" as const,
              label: `${openTickets.length} ticket${openTickets.length > 1 ? "s" : ""} ouvert${openTickets.length > 1 ? "s" : ""}`,
              sub: openTickets
                .slice(0, 2)
                .map((ticket) => `${ticket.tenant.name} — ${ticket.subject}`)
                .join(" · "),
              href: "/support",
            }
          : null,
      lateSubscriptionsCount > 0
        ? {
            id: "late-subs",
            tone: "warning" as const,
            label: `${lateSubscriptionsCount} paiement${lateSubscriptionsCount > 1 ? "s" : ""} d’abonnement en attente`,
            sub: `${formatXof(lateRecoverXof)} à encaisser`,
            href: "/abonnements",
          }
        : null,
    ].filter(Boolean);

    const professionalsAll = Math.max(professionalsTotal, tenantsTotal);
    const activeRate =
      professionalsAll > 0 ? Math.round((sitesActive / professionalsAll) * 1000) / 10 : 0;

    return {
      kpis: {
        professionalsTotal: professionalsAll,
        professionalsMonth,
        sitesActive,
        sitesActivePct: activeRate,
        sales30Xof,
        sales30Count: sales30._count._all,
        sales30DeltaPct,
        mrrXof: subscriptionRevenueMonthXof,
        subscriptionRevenueMonthXof,
        commissions30Xof,
        commissionRatePct: BOUTIK_COMMISSION_RATE * 100,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsXof,
        openTicketsCount: openTickets.length,
        highPriorityTicketsCount: highPriorityTickets.length,
        lateSubscriptionsCount,
        lateRecoverXof,
      },
      badges: {
        professionnels: suspendedTenants,
        support: openTickets.length,
        abonnements: lateSubscriptionsCount,
        retraits: pendingWithdrawals.length,
      },
      todo,
      wallet: {
        mainXof: mainWalletXof,
        proFundsXof,
        boutikMonthXof,
        commissionsMonthXof,
        monthLabel: now.toLocaleDateString("fr-FR", { month: "long" }),
      },
      inscriptions,
      categorySplit,
    };
  }
}

function buildMonthlySeries(rows: Array<{ createdAt: Date }>, now: Date) {
  const months: Array<{ key: string; label: string; value: number }> = [];
  for (let i = 9; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("fr-FR", { month: "short" }).replace(/\.$/, "");
    months.push({ key, label, value: 0 });
  }
  const index = new Map(months.map((item, i) => [item.key, i]));
  for (const row of rows) {
    const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i !== undefined) months[i]!.value += 1;
  }
  const max = Math.max(1, ...months.map((item) => item.value));
  return months.map((item) => ({
    ...item,
    heightPct: Math.round((item.value / max) * 100),
  }));
}

function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}
