"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type PlanCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  tier: "decouverte" | "pro" | "business" | null;
  featured: boolean;
  monthlyXof: number;
  isCurrent: boolean;
  highlights: string[];
  ctaLabel: string;
};

type OptionItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  amountXof: number;
  intervalLabel: string;
  activated: boolean;
  statusLabel: string;
};

type PaymentItem = {
  id: string;
  label: string;
  amountXof: number;
  status: string;
  statusLabel: string;
  method: string;
  paidAt: string | null;
  createdAt: string;
};

type Overview = {
  current: {
    planId: string | null;
    planName: string;
    planTier: string;
    interval: "MONTHLY" | "YEARLY";
    intervalLabel: string;
    amountXof: number;
    modulesXof: number;
    totalXof: number;
    nextDueAt: string | null;
    access: string;
    status: string | null;
    subscriptionId: string | null;
  };
  plans: PlanCard[];
  options: OptionItem[];
  payments: PaymentItem[];
};

export function AbonnementPage() {
  return (
    <ProShell title="Abonnement" breadcrumb="Gestion">
      <AbonnementBody />
    </ProShell>
  );
}

function AbonnementBody() {
  const [data, setData] = useState<Overview | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      const payload = await proApi<Overview>(`/api/workspaces/${active.tenantId}/subscription/overview`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l’abonnement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changePlan(plan: PlanCard) {
    if (!tenantId || plan.isCurrent) return;
    const confirmMsg =
      plan.monthlyXof <= 0
        ? `Revenir à ${plan.name} ? Les fonctionnalités payantes seront limitées.`
        : `Passer à ${plan.name} (${formatXof(plan.monthlyXof)} / mois) ?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(`plan:${plan.id}`);
    setError(null);
    try {
      const payload = await proApi<Overview>(`/api/workspaces/${tenantId}/subscription/change-plan`, {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Changement d’offre impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function renew() {
    if (!tenantId || !data) return;
    if (data.current.amountXof <= 0 && data.current.modulesXof <= 0) {
      setError("Aucune échéance à régler sur l’offre gratuite.");
      return;
    }
    if (!window.confirm("Déclarer un renouvellement ? Un paiement en attente sera créé pour validation.")) {
      return;
    }
    setBusy("renew");
    setError(null);
    try {
      const payload = await proApi<Overview>(`/api/workspaces/${tenantId}/subscription/renew`, {
        method: "POST",
        body: JSON.stringify({ method: "MOBILE_MONEY" }),
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Renouvellement impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleOption(option: OptionItem) {
    if (!tenantId) return;
    const next = !option.activated;
    const confirmMsg = next
      ? `Activer « ${option.name} » pour ${formatXof(option.amountXof)} / ${option.intervalLabel} ?`
      : `Désactiver « ${option.name} » ?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(`opt:${option.id}`);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/modules/${option.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: next }),
      });
      const payload = await proApi<Overview>(`/api/workspaces/${tenantId}/subscription/overview`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour de l’option impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-neutral-500">Chargement de l’abonnement…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || "Impossible de charger l’abonnement."}</p>;
  }

  const { current, plans, options, payments } = data;
  const priceLabel =
    current.amountXof <= 0 ? "Gratuit" : `${formatXof(current.amountXof)} / ${current.intervalLabel}`;

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="relative overflow-hidden rounded-[28px] bg-neutral-950 px-5 py-6 text-white sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 40%, rgba(255,255,255,.18), transparent 55%), radial-gradient(circle at 70% 70%, rgba(255,255,255,.12), transparent 45%)",
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight sm:text-xl">
              Offre actuelle : {current.planTier} · {priceLabel}
            </p>
            <p className="mt-2 text-sm text-white/65">
              {current.nextDueAt
                ? `Prochaine échéance : ${formatLongDate(current.nextDueAt)}`
                : "Aucune échéance planifiée"}
              {current.modulesXof > 0 ? ` · modules ${formatXof(current.modulesXof)}` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "renew" || (current.amountXof <= 0 && current.modulesXof <= 0)}
              onClick={() => void renew()}
              className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40"
            >
              {busy === "renew" ? "…" : "Renouveler"}
            </button>
            <Link
              href="/personnalisation"
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Acheter un modèle
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const currentCard = plan.isCurrent;
          const dark = currentCard || plan.featured;
          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-[28px] p-5 sm:p-6 ${
                dark ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{plan.name.replace(/^Offre\s+/i, "")}</h2>
                  <p className={`mt-1 text-sm ${dark ? "text-white/55" : "text-neutral-500"}`}>
                    {plan.monthlyXof <= 0 ? "0 FCFA / mois" : `${formatXof(plan.monthlyXof)} / mois`}
                  </p>
                </div>
                {currentCard ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Actuelle
                  </span>
                ) : null}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.highlights.map((line) => (
                  <li key={line} className="flex gap-2 text-sm">
                    <span className={dark ? "text-white/70" : "text-neutral-400"}>✓</span>
                    <span className={dark ? "text-white/85" : "text-neutral-700"}>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={currentCard || busy === `plan:${plan.id}`}
                onClick={() => void changePlan(plan)}
                className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                  currentCard
                    ? dark
                      ? "bg-white/15 text-white"
                      : "bg-neutral-100 text-neutral-500"
                    : dark
                      ? "bg-white text-neutral-950"
                      : "bg-neutral-950 text-white"
                }`}
              >
                {busy === `plan:${plan.id}` ? "…" : plan.ctaLabel}
              </button>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[28px] border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold tracking-tight">Options</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Modules à la carte · ajoutés à la facture mensuelle
            </p>
          </div>
          {options.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Aucune option disponible.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {options.map((option) => (
                <li
                  key={option.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{option.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          option.activated
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {option.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatXof(option.amountXof)} / {option.intervalLabel}
                      {option.description ? ` · ${option.description}` : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === `opt:${option.id}`}
                    onClick={() => void toggleOption(option)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium disabled:opacity-50 ${
                      option.activated
                        ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        : "bg-neutral-950 text-white hover:bg-neutral-800"
                    }`}
                  >
                    {busy === `opt:${option.id}` ? "…" : option.activated ? "Retirer" : "Ajouter"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-[28px] border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold tracking-tight">Historique des paiements</h2>
          </div>
          {payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Aucun paiement pour le moment.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatShortDate(payment.paidAt ?? payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium">{formatXof(payment.amountXof)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        payment.status === "VALIDATED"
                          ? "bg-emerald-50 text-emerald-700"
                          : payment.status === "PENDING"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {payment.statusLabel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
