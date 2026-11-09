"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type UiStatus = "active" | "trial" | "late" | "cancelled" | "none";

type SubItem = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  category: string;
  subscriptionId: string | null;
  planId: string | null;
  planName: string;
  planTier: string;
  interval: "MONTHLY" | "YEARLY";
  intervalLabel: string;
  amountXof: number;
  nextDueAt: string | null;
  status: UiStatus;
  statusLabel: string;
  pendingXof: number;
};

type PlanOption = {
  id: string;
  name: string;
  category: string;
  tier: string;
  prices: Array<{ interval: "MONTHLY" | "YEARLY"; amountXof: number }>;
};

type Payload = {
  kpis: {
    mrrXof: number;
    mrrDeltaPct: number | null;
    payingCount: number;
    trialCount: number;
    lateCount: number;
    lateXof: number;
    previousMonthLabel: string;
  };
  plans: PlanOption[];
  items: SubItem[];
};

type StatusFilter = "ALL" | UiStatus;

export function AbonnementsPage() {
  const [query, setQuery] = useState("");

  return (
    <AdminShell
      title="Abonnements"
      headerRight={
        <label className="relative block w-full">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un abonné…"
            className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>
      }
    >
      <AbonnementsBody query={query} />
    </AdminShell>
  );
}

function AbonnementsBody({ query }: { query: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payload, user] = await Promise.all([
        staffApi<Payload>("/api/admin/subscriptions"),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les abonnements.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN";

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (!q) return true;
      return (
        item.tenantName.toLowerCase().includes(q) ||
        item.planName.toLowerCase().includes(q) ||
        item.planTier.toLowerCase().includes(q) ||
        item.tenantSlug.toLowerCase().includes(q)
      );
    });
  }, [data, query, status]);

  async function run(action: () => Promise<Payload | { sent: boolean }>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if ("items" in result) setData(result);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement des abonnements…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          dark
          label="Revenu mensuel (MRR)"
          value={formatXof(data.kpis.mrrXof)}
          sub={
            data.kpis.mrrDeltaPct == null
              ? "encaissements validés ce mois"
              : `${data.kpis.mrrDeltaPct > 0 ? "+" : ""}${String(data.kpis.mrrDeltaPct).replace(".", ",")} % vs ${data.kpis.previousMonthLabel}`
          }
        />
        <Kpi label="Abonnés payants" value={String(data.kpis.payingCount)} sub="Pro et Business" />
        <Kpi
          label="En période d’essai"
          value={String(data.kpis.trialCount)}
          sub={data.kpis.trialCount > 0 ? "en cours" : "aucun essai suivi"}
        />
        <Kpi
          label="En retard de paiement"
          value={String(data.kpis.lateCount)}
          sub={data.kpis.lateCount > 0 ? formatXof(data.kpis.lateXof) : "à jour"}
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-5 py-4">
          {(
            [
              ["ALL", "Tous"],
              ["active", "Actif"],
              ["trial", "Essai"],
              ["late", "En retard"],
              ["cancelled", "Résilié"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                status === key ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
              <tr>
                <th className="px-5 py-3">Professionnel</th>
                <th className="px-5 py-3">Offre</th>
                <th className="px-5 py-3">Cycle</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Prochaine échéance</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-neutral-400">
                    Aucun abonnement pour ces filtres.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const plansForCategory = data.plans.filter((plan) => plan.category === item.category);
                  return (
                    <tr key={item.tenantId} className="border-t border-neutral-100">
                      <td className="px-5 py-4">
                        <p className="font-semibold tracking-tight">{item.tenantName}</p>
                        <p className="mt-0.5 text-xs text-neutral-400">{item.tenantSlug}.boutik.app</p>
                      </td>
                      <td className="px-5 py-4">
                        {canManage && plansForCategory.length > 0 ? (
                          <select
                            disabled={busy}
                            value={item.planId ?? ""}
                            onChange={(event) => {
                              const planId = event.target.value;
                              if (!planId || planId === item.planId) return;
                              const plan = plansForCategory.find((row) => row.id === planId);
                              if (!window.confirm(`Passer ${item.tenantName} sur ${plan?.tier ?? "cette offre"} ?`)) {
                                event.target.value = item.planId ?? "";
                                return;
                              }
                              void run(() =>
                                staffApi(`/api/admin/subscriptions/${item.tenantId}/change-plan`, {
                                  method: "POST",
                                  body: JSON.stringify({ planId, interval: item.interval }),
                                }),
                              );
                            }}
                            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-neutral-400 disabled:opacity-40"
                          >
                            {!item.planId ? <option value="">Choisir…</option> : null}
                            {plansForCategory.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.tier}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-medium">{item.planTier}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{item.intervalLabel}</td>
                      <td className="px-5 py-4 font-medium whitespace-nowrap">
                        {item.amountXof <= 0
                          ? "Gratuit"
                          : `${formatXof(item.amountXof)}${item.interval === "YEARLY" ? " / an" : " / mois"}`}
                      </td>
                      <td className="px-5 py-4 text-neutral-600 whitespace-nowrap">
                        {item.nextDueAt
                          ? new Date(item.nextDueAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} label={item.statusLabel} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {item.status === "late" ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() =>
                                void run(() =>
                                  staffApi(`/api/admin/subscriptions/${item.tenantId}/remind`, {
                                    method: "POST",
                                  }),
                                )
                              }
                            >
                              Relancer
                            </ActionButton>
                          ) : null}
                          {canManage && (item.status === "active" || item.status === "late" || item.status === "trial") ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Offrir 1 mois à ${item.tenantName} ?`)) return;
                                void run(() =>
                                  staffApi(`/api/admin/subscriptions/${item.tenantId}/gift-month`, {
                                    method: "POST",
                                  }),
                                );
                              }}
                            >
                              +1 mois offert
                            </ActionButton>
                          ) : null}
                          {canManage &&
                          (item.status === "active" || item.status === "late" || item.status === "trial") ? (
                            <ActionButton
                              danger
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Résilier l’abonnement de ${item.tenantName} ?`)) return;
                                void run(() =>
                                  staffApi(`/api/admin/subscriptions/${item.tenantId}/cancel`, {
                                    method: "POST",
                                  }),
                                );
                              }}
                            >
                              Résilier
                            </ActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
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

function StatusBadge({ status, label }: { status: UiStatus; label: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "late"
        ? "bg-amber-100 text-amber-800"
        : status === "trial"
          ? "bg-neutral-100 text-neutral-600"
          : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
        danger ? "border-red-200 text-[#b42323]" : "border-neutral-200 text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
