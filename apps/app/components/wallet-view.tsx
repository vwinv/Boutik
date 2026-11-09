"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type WalletMovement = {
  id: string;
  label: string;
  type: "sale" | "withdrawal" | "fee" | "other";
  status: string;
  amountXof: number;
  reason: string;
  createdAt: string;
};

type WalletPayload = {
  summary: {
    availableXof: number;
    salesTotalXof: number;
    withdrawnXof: number;
  };
  movements: WalletMovement[];
};

type FilterKey = "all" | "sale" | "withdrawal" | "fee";

export function WalletPage() {
  return (
    <ProShell title="Wallet">
      <WalletBody />
    </ProShell>
  );
}

function WalletBody() {
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
      const payload = await proApi<WalletPayload>(`/api/workspaces/${active.tenantId}/wallet`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.movements;
    return data.movements.filter((item) => item.type === filter);
  }, [data, filter]);

  async function submitWithdrawal(values: { amountXof: number; destination: string }) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await proApi<WalletPayload>(`/api/workspaces/${tenantId}/wallet/withdrawals`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setData(payload);
      setWithdrawOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demande de retrait impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-neutral-500">Chargement du wallet…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || "Impossible de charger le wallet."}</p>;
  }

  const { summary } = data;

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[24px] bg-neutral-950 p-5 text-white">
          <p className="text-sm text-white/60">Solde disponible</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{formatXof(summary.availableXof)}</p>
          <button
            type="button"
            disabled={summary.availableXof < 1000}
            onClick={() => setWithdrawOpen(true)}
            className="mt-5 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40"
          >
            Demander un retrait
          </button>
        </article>
        <SummaryCard
          label="Total des ventes"
          value={formatXof(summary.salesTotalXof)}
          hint="Net après commission 5 %"
        />
        <SummaryCard
          label="Total retiré"
          value={formatXof(summary.withdrawnXof)}
          hint="Retraits demandés / versés"
        />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-semibold tracking-tight">Historique</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Tous"],
                ["sale", "Vente"],
                ["withdrawal", "Retrait"],
                ["fee", "Frais"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                  filter === key ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500 sm:px-6">Aucun mouvement pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-100 text-[11px] font-semibold tracking-[0.08em] text-neutral-400 uppercase">
                <tr>
                  <th className="px-5 py-3.5 sm:px-6">Date</th>
                  <th className="px-5 py-3.5">Mouvement</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5 text-right sm:px-6">Montant</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-50 last:border-0">
                    <td className="px-5 py-4 whitespace-nowrap text-neutral-600 sm:px-6">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-5 py-4 font-medium">{row.label}</td>
                    <td className="px-5 py-4 text-neutral-600">{typeLabel(row.type)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-medium whitespace-nowrap sm:px-6 ${
                        row.amountXof < 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {row.amountXof > 0 ? "+" : ""}
                      {formatXof(Math.abs(row.amountXof))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {withdrawOpen ? (
        <WithdrawModal
          busy={busy}
          maxAmount={summary.availableXof}
          onClose={() => setWithdrawOpen(false)}
          onSubmit={submitWithdrawal}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[24px] bg-white px-5 py-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-neutral-400">{hint}</p>
    </article>
  );
}

function WithdrawModal({
  busy,
  maxAmount,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  maxAmount: number;
  onClose: () => void;
  onSubmit: (values: { amountXof: number; destination: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const amountXof = Number(amount) || 0;
  const valid = amountXof >= 1000 && amountXof <= maxAmount && destination.trim().length >= 8;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Demander un retrait</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Disponible : {formatXof(maxAmount)}. Minimum 1 000 FCFA. La demande sera validée par l’équipe BoutiK
          avant versement.
        </p>
        <label className="mt-5 block">
          <span className="text-sm text-neutral-500">Montant (FCFA)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Numéro Mobile Money</span>
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="+225…"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => onSubmit({ amountXof, destination: destination.trim() })}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function typeLabel(type: WalletMovement["type"]) {
  if (type === "sale") return "Vente";
  if (type === "withdrawal") return "Retrait";
  if (type === "fee") return "Frais";
  return "Autre";
}

function statusClass(status: string) {
  if (
    status === "En cours" ||
    status === "En attente" ||
    status === "Contre-remboursement"
  ) {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "Refusé" || status === "Annulé") return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
