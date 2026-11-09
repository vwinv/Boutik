import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES, boutikCommissionXof } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import type { AdjustWalletDto } from "./dto/admin-wallet.dto";
import { WalletService } from "./wallet.service";

@Injectable()
export class AdminWalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async overview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLabel = startOfMonth.toLocaleDateString("fr-FR", { month: "long" });

    const [tenants, monthSubs, monthPaidWithdrawals, creditedSales] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { status: { not: "ARCHIVED" } },
        include: {
          professional: { include: { owner: { select: { name: true, email: true } } } },
          _count: { select: { walletWithdrawals: true } },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: "VALIDATED", paidAt: { gte: startOfMonth } },
        _sum: { amountXof: true },
      }),
      this.prisma.walletWithdrawal.aggregate({
        where: {
          status: "PAID",
          OR: [{ paidAt: { gte: startOfMonth } }, { paidAt: null, processedAt: { gte: startOfMonth } }],
        },
        _sum: { amountXof: true },
      }),
      this.prisma.order.findMany({
        where: {
          status: { not: "CANCELLED" },
          walletEntries: { some: { type: "CREDIT", reason: "ORDER_SALE" } },
        },
        select: { totalXof: true, paidAt: true, createdAt: true },
      }),
    ]);

    const saleDate = (order: { paidAt: Date | null; createdAt: Date }) => order.paidAt ?? order.createdAt;
    const commissionsAllXof = creditedSales.reduce((sum, order) => sum + boutikCommissionXof(order.totalXof), 0);
    const commissionsMonthXof = creditedSales
      .filter((order) => saleDate(order) >= startOfMonth)
      .reduce((sum, order) => sum + boutikCommissionXof(order.totalXof), 0);
    const subscriptionRevenueMonthXof = monthSubs._sum.amountXof ?? 0;
    const boutikMonthXof = subscriptionRevenueMonthXof + commissionsMonthXof;
    const paidToProsMonthXof = monthPaidWithdrawals._sum.amountXof ?? 0;

    const professionals = await Promise.all(
      tenants.map(async (tenant) => {
        const balances = await this.wallet.getBalances(tenant.id);
        const frozen = Boolean(tenant.walletFrozenAt);
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          ownerName: tenant.professional.owner.name || tenant.professional.displayName,
          availableXof: balances.availableXof,
          pendingXof: balances.holdXof,
          withdrawalsCount: tenant._count.walletWithdrawals,
          frozen,
          status: frozen ? ("frozen" as const) : ("active" as const),
          statusLabel: frozen ? "Gelé" : "Actif",
        };
      }),
    );

    const proFundsXof = professionals.reduce((sum, row) => sum + row.availableXof + row.pendingXof, 0);
    const mainWalletXof = proFundsXof + commissionsAllXof + subscriptionRevenueMonthXof;

    return {
      kpis: {
        mainWalletXof,
        proFundsXof,
        boutikMonthXof,
        commissionsMonthXof,
        subscriptionRevenueMonthXof,
        paidToProsMonthXof,
        monthLabel,
      },
      mainMovements: await this.listMainMovements(),
      professionals,
    };
  }

  async adjust(tenantId: string, input: AdjustWalletDto, staffUserId: string) {
    await this.requireTenant(tenantId);
    const amountXof = Math.round(input.amountXof);
    if (!Number.isFinite(amountXof) || amountXof === 0) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Montant d’ajustement invalide");
    }
    const abs = Math.abs(amountXof);
    const note =
      input.note?.trim() ||
      `Ajustement admin ${amountXof > 0 ? "+" : "−"}${abs} FCFA · staff ${staffUserId.slice(0, 8)}`;

    await this.prisma.walletLedgerEntry.create({
      data: {
        tenantId,
        type: amountXof > 0 ? "CREDIT" : "DEBIT",
        reason: "ADJUSTMENT",
        amountXof: abs,
        availableAt: new Date(),
        note,
      },
    });

    return this.overview();
  }

  async freeze(tenantId: string) {
    await this.requireTenant(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { walletFrozenAt: new Date() },
    });
    return this.overview();
  }

  async unfreeze(tenantId: string) {
    await this.requireTenant(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { walletFrozenAt: null },
    });
    return this.overview();
  }

  private async listMainMovements() {
    const [saleEntries, subPayments, withdrawals] = await Promise.all([
      this.prisma.walletLedgerEntry.findMany({
        where: { type: "CREDIT", reason: "ORDER_SALE" },
        include: {
          tenant: { select: { name: true } },
          order: { select: { number: true, totalXof: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      this.prisma.subscriptionPayment.findMany({
        where: { status: "VALIDATED" },
        include: {
          subscription: {
            include: { tenant: { select: { name: true } }, plan: { select: { name: true } } },
          },
        },
        orderBy: { paidAt: "desc" },
        take: 40,
      }),
      this.prisma.walletWithdrawal.findMany({
        where: { status: { in: ["PAID", "APPROVED", "PENDING"] } },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    const commissionMoves = saleEntries.map((entry) => {
      const fee = entry.order ? boutikCommissionXof(entry.order.totalXof) : 0;
      const orderRef = entry.order?.number ? ` (${entry.order.number})` : "";
      return {
        id: `commission:${entry.id}`,
        at: entry.createdAt.toISOString(),
        label: `Commission — ${entry.tenant.name}${orderRef}`,
        kind: "commission" as const,
        kindLabel: "Commission",
        amountXof: fee,
      };
    });

    const subMoves = subPayments.map((payment) => {
      const tenantName = payment.subscription.tenant.name;
      const planName = payment.subscription.plan.name;
      return {
        id: `sub:${payment.id}`,
        at: (payment.paidAt ?? payment.createdAt).toISOString(),
        label: `Abonnement — ${tenantName} (${planName})`,
        kind: "subscription" as const,
        kindLabel: "Abonnement",
        amountXof: payment.amountXof,
      };
    });

    const payoutMoves = withdrawals.map((row) => ({
      id: `payout:${row.id}`,
      at: (row.paidAt ?? row.processedAt ?? row.createdAt).toISOString(),
      label: `Versement — ${row.tenant.name}`,
      kind: "payout" as const,
      kindLabel: "Versement",
      amountXof: -row.amountXof,
    }));

    return [...commissionMoves, ...subMoves, ...payoutMoves]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 50);
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }
    return tenant;
  }
}
