"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type StockStatus = "OK" | "LOW" | "OUT";

type StockLevel = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  productName: string;
  variantName: string | null;
  categoryName: string | null;
  stockQty: number | null;
  lowStockThreshold: number | null;
  status: StockStatus;
  hasVariants: boolean;
};

type StockGroup = {
  productId: string;
  productName: string;
  categoryName: string | null;
  hasVariants: boolean;
  levels: StockLevel[];
  totalQty: number;
  status: StockStatus;
};

type StockMovement = {
  id: string;
  delta: number;
  productId: string;
  productName: string;
  label: string;
  reason: "ORDER" | "RESTOCK" | "ADJUSTMENT";
  createdAt: string;
};

type StockPayload = {
  summary: {
    unitsInStock: number;
    lowStock: number;
    outOfStock: number;
    activeRefs: number;
  };
  barMax: number;
  levels: StockLevel[];
  movements: StockMovement[];
};

export function StockPage() {
  return (
    <ProShell title="Stock">
      <StockBody />
    </ProShell>
  );
}

function StockBody() {
  const [data, setData] = useState<StockPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openedOnce, setOpenedOnce] = useState(false);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe();
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      setTenantId(active.tenantId);
      const payload = await proApi<StockPayload>(`/api/workspaces/${active.tenantId}/stock`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restock(level: StockLevel) {
    if (!tenantId) return;
    setRestockingId(level.id);
    setError(null);
    try {
      const payload = await proApi<StockPayload>(
        `/api/workspaces/${tenantId}/stock/${level.productId}/restock`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity: 10,
            ...(level.variantId ? { variantId: level.variantId } : {}),
          }),
        },
      );
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réapprovisionnement impossible.");
    } finally {
      setRestockingId(null);
    }
  }

  const groups = useMemo(() => (data ? groupLevels(data.levels) : []), [data]);

  useEffect(() => {
    if (!data || openedOnce) return;
    const firstAlert = groupLevels(data.levels).find(
      (group) => group.hasVariants && (group.status === "LOW" || group.status === "OUT"),
    );
    setOpenId(firstAlert?.productId ?? null);
    setOpenedOnce(true);
  }, [data, openedOnce]);

  function toggleGroup(productId: string) {
    setOpenId((current) => (current === productId ? null : productId));
  }

  if (loading && !data) {
    return <p className="text-sm text-neutral-500">Chargement du stock…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || "Impossible de charger le stock."}</p>;
  }

  const { summary, movements, barMax } = data;

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Unités en stock" value={summary.unitsInStock} tone="neutral" />
        <SummaryCard label="Stock faible" value={summary.lowStock} tone="amber" />
        <SummaryCard label="En rupture" value={summary.outOfStock} tone="red" />
        <SummaryCard label="Références actives" value={summary.activeRefs} tone="neutral" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <section className="overflow-hidden rounded-[24px] bg-white">
          <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold tracking-tight">Niveaux de stock</p>
          </div>
          {groups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Aucun produit actif pour le moment.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {groups.map((group) => {
                if (!group.hasVariants) {
                  const level = group.levels[0]!;
                  return (
                    <li key={group.productId}>
                      <StockRow
                        title={group.productName}
                        subtitle={group.categoryName}
                        level={level}
                        barMax={barMax}
                        restockingId={restockingId}
                        onRestock={() => void restock(level)}
                      />
                    </li>
                  );
                }

                const open = openId === group.productId;
                const status = statusMeta(group.status);
                return (
                  <li key={group.productId}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.productId)}
                      aria-expanded={open}
                      className="flex w-full flex-col gap-3 px-5 py-4 text-left sm:flex-row sm:items-center sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="truncate text-sm font-medium">{group.productName}</p>
                          {group.categoryName ? (
                            <p className="text-xs text-neutral-400">{group.categoryName}</p>
                          ) : null}
                          <p className="text-xs text-neutral-400">
                            {group.levels.length} variante{group.levels.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="mt-2.5 flex items-center gap-3">
                          <GroupBar levels={group.levels} barMax={barMax} status={group.status} />
                          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
                            {group.totalQty}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        <span
                          className={`grid size-7 place-items-center rounded-full border border-neutral-200 text-neutral-500 transition-transform ${
                            open ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        >
                          ⌄
                        </span>
                      </div>
                    </button>
                    {open ? (
                      <ul className="border-t border-neutral-50 bg-neutral-50/60">
                        {group.levels.map((level) => (
                          <li key={level.id} className="border-b border-neutral-100/80 last:border-0">
                            <StockRow
                              title={level.variantName || level.name}
                              level={level}
                              barMax={barMax}
                              restockingId={restockingId}
                              onRestock={() => void restock(level)}
                              nested
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white">
          <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold tracking-tight">Mouvements récents</p>
          </div>
          {movements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Aucun mouvement pour le moment.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <span
                    className={`mt-0.5 w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${
                      movement.delta < 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{movement.productName}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{movement.label}</p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">{formatShortDate(movement.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StockRow({
  title,
  subtitle,
  level,
  barMax,
  restockingId,
  onRestock,
  nested = false,
}: {
  title: string;
  subtitle?: string | null;
  level: StockLevel;
  barMax: number;
  restockingId: string | null;
  onRestock: () => void;
  nested?: boolean;
}) {
  const qty = level.stockQty ?? 0;
  const pct =
    level.stockQty == null
      ? 0
      : Math.max(0, Math.min(100, Math.round((qty / Math.max(barMax, 1)) * 100)));
  const status = statusMeta(level.status);
  const barTone =
    level.status === "OUT" ? "bg-red-500" : level.status === "LOW" ? "bg-amber-500" : "bg-neutral-950";

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center ${
        nested ? "px-5 py-3.5 pl-8 sm:px-6 sm:pl-10" : "px-5 py-4 sm:px-6"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className={`truncate text-sm ${nested ? "font-normal text-neutral-800" : "font-medium"}`}>{title}</p>
          {subtitle ? <p className="text-xs text-neutral-400">{subtitle}</p> : null}
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
            {level.status === "OUT" ? (
              <span className="block size-1.5 rounded-full bg-red-500" />
            ) : (
              <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.max(pct, 4)}%` }} />
            )}
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{qty}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>{status.label}</span>
        <button
          type="button"
          disabled={restockingId === level.id}
          onClick={(event) => {
            event.stopPropagation();
            onRestock();
          }}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-40"
        >
          {restockingId === level.id ? "…" : "+10"}
        </button>
      </div>
    </div>
  );
}

function GroupBar({
  levels,
  barMax,
  status,
}: {
  levels: StockLevel[];
  barMax: number;
  status: StockStatus;
}) {
  const total = levels.reduce((sum, level) => sum + (level.stockQty ?? 0), 0);
  const pct = Math.max(0, Math.min(100, Math.round((total / Math.max(barMax, 1)) * 100)));
  const barTone = status === "OUT" ? "bg-red-500" : status === "LOW" ? "bg-amber-500" : "bg-neutral-950";
  return (
    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
      {status === "OUT" ? (
        <span className="block size-1.5 rounded-full bg-red-500" />
      ) : (
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.max(pct, 4)}%` }} />
      )}
    </div>
  );
}

function groupLevels(levels: StockLevel[]): StockGroup[] {
  const order: string[] = [];
  const byProduct = new Map<string, StockLevel[]>();
  for (const level of levels) {
    if (!byProduct.has(level.productId)) {
      byProduct.set(level.productId, []);
      order.push(level.productId);
    }
    byProduct.get(level.productId)!.push(level);
  }
  return order.map((productId) => {
    const items = byProduct.get(productId)!;
    const first = items[0]!;
    const totalQty = items.reduce((sum, level) => sum + (level.stockQty ?? 0), 0);
    return {
      productId,
      productName: first.productName,
      categoryName: first.categoryName,
      hasVariants: first.hasVariants || items.some((item) => item.variantId),
      levels: items,
      totalQty,
      status: worstStatus(items.map((item) => item.status)),
    };
  });
}

function worstStatus(statuses: StockStatus[]): StockStatus {
  if (statuses.includes("OUT")) return "OUT";
  if (statuses.includes("LOW")) return "LOW";
  return "OK";
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "amber" | "red";
}) {
  const dot =
    tone === "amber" ? "bg-amber-500" : tone === "red" ? "bg-red-500" : "bg-neutral-700";
  return (
    <article className="rounded-[24px] bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString("fr-FR")}
      </p>
    </article>
  );
}

function statusMeta(status: StockStatus) {
  if (status === "OUT") return { label: "Rupture", className: "bg-red-100 text-red-700" };
  if (status === "LOW") return { label: "Stock faible", className: "bg-amber-100 text-amber-800" };
  return { label: "Actif", className: "bg-emerald-100 text-emerald-700" };
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
