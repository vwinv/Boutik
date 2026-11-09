"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type MainMovement = {
  id: string;
  at: string;
  label: string;
  kind: "commission" | "subscription" | "payout";
  kindLabel: string;
  amountXof: number;
};

type ProWallet = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  availableXof: number;
  pendingXof: number;
  withdrawalsCount: number;
  frozen: boolean;
  status: "active" | "frozen";
  statusLabel: string;
};

type Payload = {
  kpis: {
    mainWalletXof: number;
    proFundsXof: number;
    boutikMonthXof: number;
    commissionsMonthXof: number;
    subscriptionRevenueMonthXof: number;
    paidToProsMonthXof: number;
    monthLabel: string;
  };
  mainMovements: MainMovement[];
  professionals: ProWallet[];
};

type Tab = "main" | "pros";

export function WalletsPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("main");

  return (
    <AdminShell
      title="Wallets"
      headerRight={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="relative block w-full sm:w-[240px]">
            <span className="sr-only">Rechercher</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un wallet…"
              className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
            />
          </label>
        </div>
      }
    >
      <WalletsBody query={query} tab={tab} onTabChange={setTab} />
    </AdminShell>
  );
}

function WalletsBody({
  query,
  tab,
  onTabChange,
}: {
  query: string;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payload, user] = await Promise.all([
        staffApi<Payload>("/api/admin/wallets"),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les wallets.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN";

  const filteredPros = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.professionals;
    return data.professionals.filter(
      (row) =>
        row.tenantName.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q) ||
        row.tenantSlug.toLowerCase().includes(q),
    );
  }, [data, query]);

  const filteredMoves = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.mainMovements;
    return data.mainMovements.filter(
      (row) => row.label.toLowerCase().includes(q) || row.kindLabel.toLowerCase().includes(q),
    );
  }, [data, query]);

  async function run(action: () => Promise<Payload>) {
    setBusy(true);
    setError(null);
    try {
      setData(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows =
      tab === "main"
        ? [
            ["Date", "Description", "Catégorie", "Montant"],
            ...filteredMoves.map((row) => [
              new Date(row.at).toLocaleString("fr-FR"),
              row.label,
              row.kindLabel,
              String(row.amountXof),
            ]),
          ]
        : [
            ["Professionnel", "Propriétaire", "Disponible", "En attente", "Retraits", "Statut"],
            ...filteredPros.map((row) => [
              row.tenantName,
              row.ownerName,
              String(row.availableXof),
              String(row.pendingXof),
              String(row.withdrawalsCount),
              row.statusLabel,
            ]),
          ];
    const csv = rows.map((line) => line.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = tab === "main" ? "wallet-principal.csv" : "wallets-professionnels.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement des wallets…</p>;
  }
  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["main", "Wallet principal"],
              ["pros", "Wallets professionnels"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === key ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Exporter le relevé
        </button>
      </div>

      {tab === "main" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              dark
              label="Solde du wallet principal"
              value={formatXof(data.kpis.mainWalletXof)}
              sub="Compte de cantonnement BoutiK"
            />
            <Kpi
              label="Fonds des professionnels"
              value={formatXof(data.kpis.proFundsXof)}
              sub="disponible + en attente"
            />
            <Kpi
              label={`Revenus BoutiK — ${data.kpis.monthLabel}`}
              value={formatXof(data.kpis.boutikMonthXof)}
              sub="commissions et abonnements"
            />
            <Kpi
              label="Versé aux professionnels"
              value={formatXof(data.kpis.paidToProsMonthXof)}
              sub={`retraits effectués en ${data.kpis.monthLabel}`}
            />
          </div>

          <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight">Mouvements du wallet principal</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMoves.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-neutral-400">
                        Aucun mouvement pour l’instant.
                      </td>
                    </tr>
                  ) : (
                    filteredMoves.map((row) => (
                      <tr key={row.id} className="border-t border-neutral-100">
                        <td className="px-5 py-4 whitespace-nowrap text-neutral-500">
                          {new Date(row.at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="px-5 py-4 font-medium">{row.label}</td>
                        <td className="px-5 py-4">
                          <KindBadge kind={row.kind} label={row.kindLabel} />
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-semibold whitespace-nowrap ${
                            row.amountXof >= 0 ? "text-emerald-700" : "text-neutral-950"
                          }`}
                        >
                          {row.amountXof >= 0 ? "+" : "−"}
                          {formatXof(Math.abs(row.amountXof))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
                <tr>
                  <th className="px-5 py-3">Professionnel</th>
                  <th className="px-5 py-3">Disponible</th>
                  <th className="px-5 py-3">En attente</th>
                  <th className="px-5 py-3">Retraits</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPros.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-neutral-400">
                      Aucun wallet professionnel.
                    </td>
                  </tr>
                ) : (
                  filteredPros.map((row) => (
                    <tr key={row.tenantId} className="border-t border-neutral-100">
                      <td className="px-5 py-4">
                        <p className="font-semibold tracking-tight">{row.tenantName}</p>
                        <p className="mt-0.5 text-xs text-neutral-400">{row.ownerName}</p>
                      </td>
                      <td className="px-5 py-4 font-medium whitespace-nowrap">{formatXof(row.availableXof)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-600">{formatXof(row.pendingXof)}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        {row.withdrawalsCount} retrait{row.withdrawalsCount === 1 ? "" : "s"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            row.frozen ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {canManage ? (
                            <ActionButton
                              disabled={busy}
                              onClick={() => {
                                const raw = window.prompt(
                                  `Ajustement pour ${row.tenantName} (positif = crédit, négatif = débit)`,
                                  "0",
                                );
                                if (raw == null) return;
                                const amountXof = Math.round(Number(raw.replace(/\s/g, "").replace(",", ".")));
                                if (!Number.isFinite(amountXof) || amountXof === 0) {
                                  setError("Montant d’ajustement invalide.");
                                  return;
                                }
                                const note = window.prompt("Motif (optionnel)") || undefined;
                                void run(() =>
                                  staffApi(`/api/admin/wallets/${row.tenantId}/adjust`, {
                                    method: "POST",
                                    body: JSON.stringify({ amountXof, note }),
                                  }),
                                );
                              }}
                            >
                              Ajuster
                            </ActionButton>
                          ) : null}
                          {canManage ? (
                            <ActionButton
                              danger={row.frozen}
                              disabled={busy}
                              onClick={() => {
                                const action = row.frozen ? "unfreeze" : "freeze";
                                const label = row.frozen ? "Dégeler" : "Geler";
                                if (!window.confirm(`${label} le wallet de ${row.tenantName} ?`)) return;
                                void run(() =>
                                  staffApi(`/api/admin/wallets/${row.tenantId}/${action}`, {
                                    method: "POST",
                                  }),
                                );
                              }}
                            >
                              {row.frozen ? "Dégeler" : "Geler"}
                            </ActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
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

function KindBadge({ kind, label }: { kind: MainMovement["kind"]; label: string }) {
  const tone =
    kind === "commission"
      ? "bg-emerald-100 text-emerald-800"
      : kind === "subscription"
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

function csvEscape(value: string) {
  if (/[;"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
