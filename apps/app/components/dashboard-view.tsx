"use client";

import { useEffect, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, formatXof, readProSession, fetchProMe } from "../lib/auth";
import { ProShell } from "./pro-shell";

type DashboardData = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    category: string;
    host: string;
    url: string;
    siteTitle: string;
    siteStatus: string;
  };
  kpis: {
    customersTotal: number;
    customersWeek: number;
    customersDeltaPct: number;
    ordersTotal: number;
    ordersDeltaPct: number;
    ordersToProcess: number;
    revenue30Xof: number;
    revenue30DeltaPct: number;
    balanceAvailableXof: number;
    balanceWithdrawnXof: number;
    balancePendingXof: number;
    weekRevenueXof: number;
    monthRevenueXof: number;
    goalTargetXof: number;
    goalPct: number;
  };
  weekBars: Array<{
    key: string;
    label: string;
    totalXof: number;
    count: number;
    valueK: number;
    heightPct: number;
    isToday: boolean;
  }>;
  heat: number[][];
  recentOrders: Array<{
    id: string;
    number: string;
    customerName: string;
    totalXof: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  stockAlerts: Array<{
    id: string;
    name: string;
    availability: string;
    priceXof: number;
  }>;
  catalog: { productsActive: number; outOfStock: number };
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Nouvelle",
  CONFIRMED: "Confirmée",
  PREPARING: "Préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  PICKED_UP: "Récupérée",
  CANCELLED: "Annulée",
};

export function DashboardPage() {
  return (
    <ProShell title="Tableau de bord">
      <DashboardBody />
    </ProShell>
  );
}

function DashboardBody() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readProSession();
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchProMe(session.accessToken)
      .then((me) => {
        const active = activeProMembership(me);
        if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
        return proApi<DashboardData>(`/api/workspaces/${active.tenantId}/dashboard`);
      })
      .then((dashboard) => {
        if (!cancelled) setData(dashboard);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger le tableau de bord.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[24px] bg-white" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white px-5 py-8 text-sm text-red-600">
        {error || "Données indisponibles."}
      </div>
    );
  }

  const { kpis, workspace, weekBars, heat, recentOrders, stockAlerts } = data;
  const statusLabel =
    workspace.siteStatus === "PUBLISHED"
      ? "Publié"
      : workspace.siteStatus === "SUSPENDED"
        ? "Suspendu"
        : "Brouillon";
  const statusTone =
    workspace.siteStatus === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-700"
      : workspace.siteStatus === "SUSPENDED"
        ? "bg-red-100 text-red-700"
        : "bg-[#ffedd5] text-[#c2410c]";

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Clients"
          value={kpis.customersTotal.toLocaleString("fr-FR")}
          delta={formatDelta(kpis.customersDeltaPct)}
          hint={kpis.customersWeek > 0 ? `+${kpis.customersWeek} cette semaine` : "aucun nouveau cette semaine"}
        />
        <MetricCard
          label="Commandes · 30 j"
          value={String(kpis.ordersTotal)}
          delta={formatDelta(kpis.ordersDeltaPct)}
          hint={`${kpis.ordersToProcess} à traiter`}
        />
        <MetricCard
          label="Chiffre d’affaires · 30 j"
          value={formatXof(kpis.revenue30Xof)}
          delta={formatDelta(kpis.revenue30DeltaPct)}
          hint="net après commission 5 %"
        />
        <article className="rounded-[24px] bg-neutral-950 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-white/60">Solde disponible</p>
            <span className="text-white/50">↗</span>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{formatXof(kpis.balanceAvailableXof)}</p>
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-sm text-white/60">Total retiré</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-white/90">
              {formatXof(kpis.balanceWithdrawnXof ?? 0)}
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <article className="rounded-[24px] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Ventes de la semaine</h2>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{formatXof(kpis.weekRevenueXof)}</p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600">
              7 derniers jours
            </span>
          </div>
          {weekBars.every((bar) => bar.totalXof === 0) ? (
            <p className="mt-10 text-sm text-neutral-500">Aucune vente sur les 7 derniers jours.</p>
          ) : (
            <div className="mt-8 flex h-48 items-end gap-3 sm:gap-4">
              {weekBars.map((bar) => (
                <div key={bar.key} className="flex flex-1 flex-col items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                    {bar.valueK}k
                  </span>
                  <div
                    className="w-full max-w-10 rounded-t-lg"
                    style={{
                      height: `${Math.max(bar.heightPct, bar.totalXof > 0 ? 8 : 2)}%`,
                      background: bar.isToday
                        ? "#e5e5e5"
                        : "repeating-linear-gradient(-45deg, #171717, #171717 3px, #2a2a2a 3px, #2a2a2a 6px)",
                    }}
                  />
                  <span className="text-xs text-neutral-500">{bar.label}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <div className="grid gap-4">
          <article className="rounded-[24px] bg-neutral-950 p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/55">Statut du site</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">{workspace.siteTitle || workspace.name}</p>
                <p className="mt-1 text-sm text-white/55">{workspace.host}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>{statusLabel}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={workspace.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950"
              >
                Voir mon site
              </a>
              <button type="button" className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white opacity-60" disabled>
                Modifier
              </button>
            </div>
          </article>

          <article className="rounded-[24px] bg-white p-5">
            <p className="text-sm font-medium text-neutral-500">Objectif du mois</p>
            <div className="mt-4 flex items-center gap-4">
              <GoalRing pct={kpis.goalPct} />
              <div>
                <p className="text-3xl font-semibold tracking-tight">{kpis.goalPct}%</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatXof(kpis.monthRevenueXof)} / {formatXof(kpis.goalTargetXof)}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[24px] bg-white p-5">
          <h2 className="text-base font-semibold tracking-tight">Commandes récentes</h2>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Aucune commande pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-neutral-500">
                      {order.number} · {formatXof(order.totalXof)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-[24px] bg-white p-5">
          <h2 className="text-base font-semibold tracking-tight">Stock</h2>
          {stockAlerts.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Aucun produit en rupture.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {stockAlerts.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-neutral-500">{formatXof(product.priceXof)}</p>
                  </div>
                  <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-medium text-white">
                    Rupture
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-[24px] bg-white p-5">
          <h2 className="text-base font-semibold tracking-tight">Fréquentation commandes</h2>
          <p className="mt-1 text-xs text-neutral-400">Répartition des commandes (7 j)</p>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
            <div className="space-y-3 pt-5 text-xs text-neutral-500">
              <p>Matin</p>
              <p>Midi</p>
              <p>Soir</p>
            </div>
            <div>
              <div className="mb-2 grid grid-cols-6 gap-2 text-center text-[11px] text-neutral-400">
                {["L", "M", "M", "J", "V", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="space-y-2">
                {heat.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-6 gap-2">
                    {row.map((level, colIndex) => (
                      <span
                        key={`${rowIndex}-${colIndex}`}
                        className="aspect-square rounded-md"
                        style={{
                          background:
                            level === 1
                              ? "#e5e5e5"
                              : level === 2
                                ? "#a3a3a3"
                                : level === 3
                                  ? "#525252"
                                  : "#171717",
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function StatusBadge({ status }: { status: string }) {
  const label = ORDER_STATUS_LABEL[status] || status;
  const isNew = status === "PENDING";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
        isNew ? "bg-[#ffedd5] text-[#c2410c]" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: string;
  hint?: string;
}) {
  const positive = !delta.trim().startsWith("-");
  return (
    <article className="rounded-[24px] bg-white p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <span className={`text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>{delta}</span>
      </div>
      {hint ? <p className="mt-2 text-xs text-neutral-400">{hint}</p> : null}
    </article>
  );
}

function GoalRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="grid size-20 place-items-center rounded-full"
      style={{ background: `conic-gradient(#171717 ${clamped}%, #e5e5e5 0)` }}
    >
      <span className="grid size-14 place-items-center rounded-full bg-white text-sm font-semibold">{clamped}%</span>
    </div>
  );
}
