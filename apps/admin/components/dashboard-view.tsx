"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { staffApi } from "../lib/api";
import { formatCompactXof, formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type DashboardPayload = {
  kpis: {
    professionalsTotal: number;
    professionalsMonth: number;
    sitesActive: number;
    sitesActivePct: number;
    sales30Xof: number;
    sales30Count: number;
    sales30DeltaPct: number | null;
    mrrXof: number;
    commissions30Xof: number;
    commissionRatePct: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsXof: number;
    openTicketsCount: number;
    highPriorityTicketsCount: number;
    lateSubscriptionsCount: number;
    lateRecoverXof: number;
  };
  todo: Array<{
    id: string;
    tone: "warning" | "danger" | "neutral";
    label: string;
    sub: string;
    href: string;
  }>;
  wallet: {
    mainXof: number;
    proFundsXof: number;
    boutikMonthXof: number;
    commissionsMonthXof: number;
    monthLabel: string;
  };
  inscriptions: Array<{ key: string; label: string; value: number; heightPct: number }>;
  categorySplit: Array<{ key: string; label: string; count: number; pct: number }>;
};

export function DashboardPage() {
  return (
    <AdminShell title="Tableau de bord">
      <DashboardBody />
    </AdminShell>
  );
}

function DashboardBody() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void staffApi<DashboardPayload>("/api/admin/dashboard")
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-neutral-500">Chargement du tableau de bord…</p>;

  const { kpis, todo, wallet, inscriptions, categorySplit } = data;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          dark
          label="Professionnels inscrits"
          value={kpis.professionalsTotal.toLocaleString("fr-FR")}
          sub={`+${kpis.professionalsMonth} ce mois`}
        />
        <KpiCard
          label="Sites actifs"
          value={kpis.sitesActive.toLocaleString("fr-FR")}
          sub={`${String(kpis.sitesActivePct).replace(".", ",")} % des inscrits`}
        />
        <KpiCard
          label="Ventes · 30 j"
          value={formatCompactXof(kpis.sales30Xof)}
          sub={
            kpis.sales30DeltaPct != null
              ? `${kpis.sales30DeltaPct > 0 ? "+" : ""}${String(kpis.sales30DeltaPct).replace(".", ",")} % · ${kpis.sales30Count} cmd`
              : `${kpis.sales30Count} commande${kpis.sales30Count > 1 ? "s" : ""}`
          }
        />
        <KpiCard label="Revenus abonnements" value={formatXof(kpis.mrrXof)} sub="Encaissés ce mois" />
        <KpiCard
          label="Commissions · 30 j"
          value={formatXof(kpis.commissions30Xof)}
          sub={`${String(kpis.commissionRatePct).replace(".", ",")} % sur chaque vente`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Retraits en attente"
          value={String(kpis.pendingWithdrawalsCount)}
          sub={formatXof(kpis.pendingWithdrawalsXof)}
        />
        <KpiCard
          label="Tickets ouverts"
          value={String(kpis.openTicketsCount)}
          sub={`${kpis.highPriorityTicketsCount} priorité haute`}
        />
        <KpiCard
          label="Abonnements en retard"
          value={String(kpis.lateSubscriptionsCount)}
          sub={`${formatXof(kpis.lateRecoverXof)} à recouvrer`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">À traiter</h2>
          {todo.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">Rien en attente pour le moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100">
              {todo.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-4 first:pt-2 last:pb-0">
                  <span
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      item.tone === "danger"
                        ? "bg-[#e5484d]"
                        : item.tone === "warning"
                          ? "bg-[#f5a524]"
                          : "bg-neutral-950"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight">{item.label}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.sub}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 text-sm font-medium text-neutral-500 hover:text-neutral-950"
                  >
                    Traiter →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[24px] bg-[#1d1d1f] p-5 text-white sm:p-6">
          <p className="text-sm text-white/55">Wallet principal</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{formatXof(wallet.mainXof)}</p>
          <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/55">Fonds des professionnels</span>
              <span className="font-medium">{formatXof(wallet.proFundsXof)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/55">Commissions · {wallet.monthLabel}</span>
              <span className="font-medium">{formatXof(wallet.commissionsMonthXof)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/55">Revenus BoutiK · {wallet.monthLabel}</span>
              <span className="font-medium">{formatXof(wallet.boutikMonthXof)}</span>
            </div>
          </div>
          <Link
            href="/wallets"
            className="mt-6 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950"
          >
            Voir les wallets
          </Link>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Nouvelles inscriptions par mois</h2>
          <div className="mt-8 flex h-48 items-end gap-2 sm:gap-3">
            {inscriptions.map((bar) => (
              <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="relative flex h-40 w-full items-end justify-center">
                  {bar.value > 0 ? (
                    <span className="absolute -top-6 rounded-md bg-neutral-950 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {bar.value}
                    </span>
                  ) : null}
                  <div
                    className="w-full max-w-8 rounded-t-md bg-neutral-950"
                    style={{
                      height: `${Math.max(bar.heightPct, bar.value > 0 ? 8 : 2)}%`,
                      backgroundImage:
                        "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.12) 3px, rgba(255,255,255,0.12) 6px)",
                    }}
                  />
                </div>
                <span className="truncate text-[11px] text-neutral-400">{bar.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Répartition par catégorie</h2>
          <div className="mt-8 flex h-4 overflow-hidden rounded-full bg-neutral-100">
            {categorySplit.map((slice, index) => (
              <div
                key={slice.key}
                className={index === 2 ? "bg-neutral-300" : "bg-neutral-950"}
                style={{ width: `${slice.pct}%`, opacity: index === 1 ? 0.72 : 1 }}
                title={`${slice.label} ${slice.pct}%`}
              />
            ))}
          </div>
          <ul className="mt-6 space-y-3">
            {categorySplit.map((slice, index) => (
              <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-neutral-600">
                  <span
                    className={`size-2.5 rounded-full ${index === 2 ? "bg-neutral-300" : "bg-neutral-950"}`}
                    style={{ opacity: index === 1 ? 0.72 : 1 }}
                  />
                  {slice.label}
                </span>
                <span className="font-semibold">{slice.pct} %</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <article
      className={`rounded-[22px] px-4 py-4 ${
        dark ? "bg-[#1d1d1f] text-white" : "border border-neutral-200 bg-white text-neutral-950"
      }`}
    >
      <p className={`text-sm ${dark ? "text-white/55" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${dark ? "text-white/45" : "text-neutral-400"}`}>{sub}</p>
    </article>
  );
}
