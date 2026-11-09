import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "./wallet.service";

@Injectable()
export class AdminWithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: ProNotificationsService,
  ) {}

  async list() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLabel = startOfMonth.toLocaleDateString("fr-FR", { month: "long" });

    const [rows, paidMonth] = await Promise.all([
      this.prisma.walletWithdrawal.findMany({
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              professional: { select: { displayName: true, owner: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.walletWithdrawal.findMany({
        where: {
          status: "PAID",
          OR: [{ paidAt: { gte: startOfMonth } }, { paidAt: null, processedAt: { gte: startOfMonth } }],
        },
        select: { amountXof: true, method: true },
      }),
    ]);

    const pending = rows.filter((row) => row.status === "PENDING");
    const approved = rows.filter((row) => row.status === "APPROVED");
    const rejected = rows.filter((row) => row.status === "REJECTED");

    const paidByMethod = new Map<string, number>();
    for (const row of paidMonth) {
      const key = methodLabel(row.method);
      paidByMethod.set(key, (paidByMethod.get(key) ?? 0) + row.amountXof);
    }

    const items = await Promise.all(
      rows.map(async (row) => {
        const balances = await this.wallet.getBalances(row.tenantId);
        return {
          id: row.id,
          ref: withdrawalRef(row.id),
          tenantId: row.tenantId,
          tenantName: row.tenant.name,
          tenantSlug: row.tenant.slug,
          ownerName: row.tenant.professional.owner.name || row.tenant.professional.displayName,
          amountXof: row.amountXof,
          method: row.method,
          methodLabel: methodLabel(row.method),
          destination: row.destination,
          destinationName: row.destinationName,
          availableBalanceXof: balances.availableXof,
          status: uiStatus(row.status),
          statusLabel: statusLabel(row.status),
          failureReason: row.failureReason,
          note: row.note,
          createdAt: row.createdAt.toISOString(),
          processedAt: row.processedAt?.toISOString() ?? null,
          paidAt: row.paidAt?.toISOString() ?? null,
        };
      }),
    );

    return {
      kpis: {
        pendingCount: pending.length,
        pendingXof: pending.reduce((sum, row) => sum + row.amountXof, 0),
        approvedCount: approved.length,
        approvedXof: approved.reduce((sum, row) => sum + row.amountXof, 0),
        paidMonthXof: paidMonth.reduce((sum, row) => sum + row.amountXof, 0),
        paidMonthMethods: [...paidByMethod.entries()]
          .map(([label, amountXof]) => ({ label, amountXof }))
          .sort((a, b) => b.amountXof - a.amountXof),
        rejectedCount: rejected.length,
        monthLabel,
      },
      items,
    };
  }

  async accept(id: string) {
    const row = await this.requireStatus(id, "PENDING");
    const balances = await this.wallet.getBalances(row.tenantId);
    // Cette demande PENDING n’est pas encore débitée : elle compte dans le disponible.
    if (row.amountXof > balances.availableXof) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "Solde disponible insuffisant pour accepter ce retrait",
      );
    }

    // Débit ledger uniquement à l’acceptation BoutiK.
    await this.prisma.$transaction(async (tx) => {
      await tx.walletWithdrawal.update({
        where: { id },
        data: { status: "APPROVED", processedAt: new Date(), failureReason: null },
      });
      await tx.walletLedgerEntry.create({
        data: {
          tenantId: row.tenantId,
          type: "DEBIT",
          reason: "WITHDRAWAL",
          amountXof: row.amountXof,
          withdrawalId: row.id,
          availableAt: new Date(),
          note: `Retrait accepté · ${row.destination}`,
        },
      });
    });

    await this.notifications.notify({
      tenantId: row.tenantId,
      kind: "WITHDRAWALS",
      title: "Retrait accepté",
      body: `Votre demande de ${formatXof(row.amountXof)} a été acceptée. Versement en cours.`,
      href: "/wallet",
      dedupeKey: `withdrawal:approved:${id}`,
    });
    return this.list();
  }

  async reject(id: string, reason?: string) {
    const row = await this.requireStatus(id, "PENDING");
    const message = reason?.trim() || "Demande rejetée par l’administration";

    // Pas de re-crédit : le wallet n’avait pas été débité en attente.
    await this.prisma.walletWithdrawal.update({
      where: { id },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        failureReason: message,
      },
    });

    await this.notifications.notify({
      tenantId: row.tenantId,
      kind: "WITHDRAWALS",
      title: "Retrait rejeté",
      body: `Demande de ${formatXof(row.amountXof)} refusée · ${message}`,
      href: "/wallet",
      dedupeKey: `withdrawal:rejected:${id}`,
    });
    return this.list();
  }

  async markPaid(id: string) {
    const row = await this.requireStatus(id, "APPROVED");
    await this.prisma.walletWithdrawal.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), processedAt: row.processedAt ?? new Date() },
    });
    await this.notifications.notify({
      tenantId: row.tenantId,
      kind: "WITHDRAWALS",
      title: "Retrait versé",
      body: `${formatXof(row.amountXof)} versés vers ${row.destination}`,
      href: "/wallet",
      dedupeKey: `withdrawal:paid:${id}`,
    });
    return this.list();
  }

  private async requireStatus(id: string, expected: "PENDING" | "APPROVED") {
    const row = await this.prisma.walletWithdrawal.findUnique({ where: { id } });
    if (!row) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Demande de retrait introuvable");
    }
    if (row.status !== expected) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        expected === "PENDING"
          ? "Seule une demande en attente peut être traitée ainsi"
          : "Seule une demande acceptée peut être marquée versée",
      );
    }
    return row;
  }
}

function uiStatus(status: string): "pending" | "approved" | "paid" | "rejected" | "cancelled" {
  if (status === "PENDING") return "pending";
  if (status === "APPROVED") return "approved";
  if (status === "PAID") return "paid";
  if (status === "REJECTED") return "rejected";
  return "cancelled";
}

function statusLabel(status: string) {
  if (status === "PENDING") return "En attente";
  if (status === "APPROVED") return "Accepté";
  if (status === "PAID") return "Effectué";
  if (status === "REJECTED") return "Rejeté";
  return "Annulé";
}

function methodLabel(method: string) {
  const key = method.trim().toLowerCase();
  if (key === "wave") return "Wave";
  if (key === "orange" || key === "orange_money" || key === "orangemoney") return "Orange Money";
  if (key === "mtn" || key === "mtn_momo" || key === "momo") return "MTN MoMo";
  if (key === "mobile_money" || key === "mobile-money") return "Mobile Money";
  return method || "Mobile Money";
}

function withdrawalRef(id: string) {
  return `RT-${id.slice(-4).toUpperCase()}`;
}

function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}
