import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { boutikCommissionXof, proNetSaleXof } from "@boutik/domain";
import { PrismaService } from "../prisma/prisma.service";

type OrderSaleInput = {
  id: string;
  tenantId: string;
  totalXof: number;
  paidAt?: Date | null;
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Crédite le wallet pro après une vente encaissée (net de commission Boutik 5 %). */
  async creditOrderSale(order: OrderSaleInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    // Disponibilité immédiate dès l’encaissement.
    const availableAt = order.paidAt && order.paidAt.getTime() <= Date.now() ? order.paidAt : new Date();
    const netXof = proNetSaleXof(order.totalXof);
    const feeXof = boutikCommissionXof(order.totalXof);
    try {
      await db.walletLedgerEntry.create({
        data: {
          tenantId: order.tenantId,
          type: "CREDIT",
          reason: "ORDER_SALE",
          amountXof: netXof,
          orderId: order.id,
          availableAt,
          note: `Vente commande ${order.id} · net après commission Boutik ${feeXof} FCFA (5 %)`,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }

  /** Débite le wallet pro lors d’un remboursement client (montant net précédemment crédité). */
  async debitOrderRefund(order: OrderSaleInput, note?: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const netXof = proNetSaleXof(order.totalXof);
    try {
      await db.walletLedgerEntry.create({
        data: {
          tenantId: order.tenantId,
          type: "DEBIT",
          reason: "REFUND",
          amountXof: netXof,
          orderId: order.id,
          availableAt: new Date(),
          note: note || `Remboursement commande ${order.id} · net ${netXof} FCFA`,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }

  /**
   * Crédite le ledger pour les ventes encaissées :
   * - paiement SoftPay PAID
   * - COD / commande livrée ou terminée
   */
  async syncPaidOrders(tenantId: string) {
    const eligible = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
        walletEntries: { none: { reason: "ORDER_SALE" } },
        OR: [
          { paymentStatus: "PAID" },
          { status: { in: ["DELIVERED", "PICKED_UP"] } },
        ],
      },
      select: { id: true, tenantId: true, totalXof: true, paidAt: true, updatedAt: true, createdAt: true },
    });
    for (const order of eligible) {
      await this.creditOrderSale({
        id: order.id,
        tenantId: order.tenantId,
        totalXof: order.totalXof,
        paidAt: order.paidAt ?? order.updatedAt ?? order.createdAt,
      });
    }
    if (eligible.length > 0) {
      this.logger.log(`Wallet sync tenant=${tenantId}: ${eligible.length} vente(s) créditée(s)`);
    }
  }

  async getBalances(tenantId: string) {
    await this.syncPaidOrders(tenantId);
    const now = new Date();
    const [entries, openOrders] = await Promise.all([
      this.prisma.walletLedgerEntry.findMany({
        where: { tenantId },
        select: { type: true, reason: true, amountXof: true, availableAt: true },
      }),
      this.prisma.order.findMany({
        where: {
          tenantId,
          status: { not: "CANCELLED" },
          OR: [
            { paymentStatus: { in: ["PENDING", "COD"] } },
            {
              AND: [
                { paymentStatus: { not: "PAID" } },
                { status: { notIn: ["DELIVERED", "PICKED_UP"] } },
              ],
            },
          ],
          walletEntries: { none: { reason: "ORDER_SALE" } },
        },
        select: { totalXof: true },
      }),
    ]);

    let creditedAvailable = 0;
    let creditedPending = 0;
    let withdrawn = 0;
    let salesCredited = 0;
    let withdrawnOnly = 0;

    for (const entry of entries) {
      if (entry.type === "CREDIT") {
        if (entry.reason === "ORDER_SALE") salesCredited += entry.amountXof;
        if (entry.availableAt <= now) {
          creditedAvailable += entry.amountXof;
        } else {
          creditedPending += entry.amountXof;
        }
        continue;
      }
      if (entry.type === "DEBIT" && entry.reason === "WITHDRAWAL") {
        withdrawn += entry.amountXof;
        withdrawnOnly += entry.amountXof;
        continue;
      }
      if (entry.type === "DEBIT" && (entry.reason === "REFUND" || entry.reason === "ADJUSTMENT")) {
        withdrawn += entry.amountXof;
      }
    }

    // En attente = ce que le pro recevra (95 %), pas le brut client.
    const openPendingXof = openOrders.reduce((sum, order) => sum + proNetSaleXof(order.totalXof), 0);

    return {
      /** Ventes disponibles − retraits/remboursements (ce que le pro peut encore demander). */
      availableXof: Math.max(0, creditedAvailable - withdrawn),
      /** Total déjà retiré (demandes / versements). */
      withdrawnXof: withdrawnOnly,
      /** Crédits pas encore libérés + commandes pas encore encaissées. */
      holdXof: creditedPending + openPendingXof,
      /** Cumul des ventes créditées au ledger. */
      salesTotalXof: salesCredited,
      openPendingXof,
    };
  }

  async getOverview(tenantId: string) {
    const balances = await this.getBalances(tenantId);
    const [entries, withdrawals, salesOrders] = await Promise.all([
      this.prisma.walletLedgerEntry.findMany({
        where: { tenantId },
        include: {
          order: { select: { id: true, number: true } },
          withdrawal: { select: { id: true, status: true, destination: true, method: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.walletWithdrawal.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: { tenantId, status: { not: "CANCELLED" } },
        select: {
          id: true,
          number: true,
          totalXof: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          walletEntries: { where: { reason: "ORDER_SALE" }, select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    // CA / total ventes pro = net crédité (95 %), pas le brut client.
    const salesTotalXof = salesOrders.reduce((sum, order) => sum + proNetSaleXof(order.totalXof), 0);

    const ledgerMovements = entries.map((entry) => {
      const signed = entry.type === "CREDIT" ? entry.amountXof : -entry.amountXof;
      let label = entry.note?.trim() || reasonLabel(entry.reason);
      if (entry.order?.number) label = `Commande ${entry.order.number}`;
      if (entry.reason === "WITHDRAWAL" && entry.withdrawal) {
        label = `Retrait vers ${entry.withdrawal.destination || entry.withdrawal.method}`;
      }
      return {
        id: entry.id,
        label,
        type: movementType(entry.reason),
        status: movementStatus(entry),
        amountXof: signed,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
      };
    });

    const pendingOrderMovements = salesOrders
      .filter((order) => order.walletEntries.length === 0)
      .map((order) => ({
        id: `order-pending:${order.id}`,
        label: `Commande ${order.number}`,
        type: "sale" as const,
        status: order.paymentStatus === "COD" ? "Contre-remboursement" : "En attente",
        amountXof: proNetSaleXof(order.totalXof),
        reason: "ORDER_SALE",
        createdAt: order.createdAt.toISOString(),
      }));

    const movements = [...ledgerMovements, ...pendingOrderMovements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return {
      summary: {
        availableXof: balances.availableXof,
        pendingXof: balances.holdXof,
        salesTotalXof,
        withdrawnXof: balances.withdrawnXof,
      },
      movements,
      withdrawals: withdrawals.map((row) => ({
        id: row.id,
        amountXof: row.amountXof,
        status: row.status,
        method: row.method,
        destination: row.destination,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async requestWithdrawal(
    tenantId: string,
    userId: string,
    input: { amountXof: number; destination: string; destinationName?: string; method?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { walletFrozenAt: true },
    });
    if (tenant?.walletFrozenAt) {
      throw new Error("WALLET_FROZEN");
    }

    const amountXof = Math.round(input.amountXof);
    if (!Number.isFinite(amountXof) || amountXof < 1000) {
      throw new Error("INVALID_AMOUNT");
    }
    const destination = input.destination.trim();
    if (destination.length < 8) {
      throw new Error("INVALID_DESTINATION");
    }

    const balances = await this.getBalances(tenantId);
    const pendingReservedXof = await this.pendingWithdrawalReservedXof(tenantId);
    // En attente : pas encore débité, mais réservé pour éviter les doubles demandes.
    if (amountXof > balances.availableXof - pendingReservedXof) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    // Pas de débit ledger tant que BoutiK n’a pas accepté la demande.
    const withdrawal = await this.prisma.walletWithdrawal.create({
      data: {
        tenantId,
        amountXof,
        method: input.method?.trim() || "MOBILE_MONEY",
        destination,
        destinationName: input.destinationName?.trim() || null,
        requestedByUserId: userId,
        status: "PENDING",
      },
    });

    return {
      overview: await this.getOverview(tenantId),
      withdrawal: {
        id: withdrawal.id,
        amountXof: withdrawal.amountXof,
        destination: withdrawal.destination,
      },
    };
  }

  /** Montant des demandes PENDING (pas encore débitées au ledger). */
  async pendingWithdrawalReservedXof(tenantId: string) {
    const pending = await this.prisma.walletWithdrawal.aggregate({
      where: { tenantId, status: "PENDING" },
      _sum: { amountXof: true },
    });
    return pending._sum.amountXof ?? 0;
  }
}

function reasonLabel(reason: string) {
  if (reason === "ORDER_SALE") return "Vente";
  if (reason === "WITHDRAWAL") return "Retrait";
  if (reason === "REFUND") return "Remboursement";
  return "Ajustement";
}

function movementType(reason: string): "sale" | "withdrawal" | "fee" | "other" {
  if (reason === "ORDER_SALE") return "sale";
  if (reason === "WITHDRAWAL") return "withdrawal";
  if (reason === "REFUND" || reason === "ADJUSTMENT") return "fee";
  return "other";
}

function movementStatus(entry: {
  type: string;
  reason: string;
  availableAt: Date;
  withdrawal?: { status: string } | null;
}) {
  if (entry.withdrawal?.status) {
    if (entry.withdrawal.status === "PAID") return "Versé";
    if (entry.withdrawal.status === "APPROVED") return "Approuvé";
    if (entry.withdrawal.status === "REJECTED") return "Refusé";
    if (entry.withdrawal.status === "CANCELLED") return "Annulé";
    return "En cours";
  }
  if (entry.type === "CREDIT" && entry.availableAt > new Date()) return "En attente";
  if (entry.reason === "REFUND") return "Remboursé";
  return "Terminé";
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

