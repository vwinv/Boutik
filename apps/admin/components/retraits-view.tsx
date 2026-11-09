"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type UiStatus = "pending" | "approved" | "paid" | "rejected" | "cancelled";

type WithdrawalItem = {
  id: string;
  ref: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  amountXof: number;
  method: string;
  methodLabel: string;
  destination: string;
  destinationName: string | null;
  availableBalanceXof: number;
  status: UiStatus;
  statusLabel: string;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  paidAt: string | null;
};

type Payload = {
  kpis: {
    pendingCount: number;
    pendingXof: number;
    approvedCount: number;
    approvedXof: number;
    paidMonthXof: number;
    paidMonthMethods: Array<{ label: string; amountXof: number }>;
    rejectedCount: number;
    monthLabel: string;
  };
  items: WithdrawalItem[];
};

type StatusFilter = "ALL" | UiStatus;

export function RetraitsPage() {
  const [query, setQuery] = useState("");

  return (
    <AdminShell
      title="Demandes de retrait"
      headerRight={
        <label className="relative block w-full">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une demande…"
            className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>
      }
    >
      <RetraitsBody query={query} />
    </AdminShell>
  );
}

function RetraitsBody({ query }: { query: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payload, user] = await Promise.all([
        staffApi<Payload>("/api/admin/withdrawals"),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les retraits.");
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
        item.ref.toLowerCase().includes(q) ||
        item.tenantName.toLowerCase().includes(q) ||
        item.ownerName.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q) ||
        item.methodLabel.toLowerCase().includes(q)
      );
    });
  }, [data, query, status]);

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

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement des demandes…</p>;
  }
  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const paidMethodsHint =
    data.kpis.paidMonthMethods.length > 0
      ? data.kpis.paidMonthMethods.map((row) => row.label).join(", ")
      : "aucun versement ce mois";

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          dark
          label="En attente"
          value={String(data.kpis.pendingCount)}
          sub={formatXof(data.kpis.pendingXof)}
        />
        <Kpi
          label="Acceptés — à verser"
          value={String(data.kpis.approvedCount)}
          sub={formatXof(data.kpis.approvedXof)}
        />
        <Kpi
          label={`Versés — ${data.kpis.monthLabel}`}
          value={formatXof(data.kpis.paidMonthXof)}
          sub={paidMethodsHint}
        />
        <Kpi
          label="Rejetés"
          value={String(data.kpis.rejectedCount)}
          sub="sans débit wallet"
        />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-5 py-4">
          {(
            [
              ["ALL", "Tous"],
              ["pending", "En attente"],
              ["approved", "Accepté"],
              ["paid", "Effectué"],
              ["rejected", "Rejeté"],
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

        <ul className="divide-y divide-neutral-100">
          {filtered.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-neutral-400">Aucune demande pour ces filtres.</li>
          ) : (
            filtered.map((item) => (
              <li key={item.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight">{item.ref}</p>
                    <StatusBadge status={item.status} label={item.statusLabel} />
                  </div>
                  <p className="mt-1 text-sm font-medium">{item.tenantName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.methodLabel} · {item.destination}
                    {" · "}
                    {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {" · "}
                    solde {formatXof(item.availableBalanceXof)}
                  </p>
                  {item.failureReason ? (
                    <p className="mt-1 text-xs text-red-600">{item.failureReason}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <p className="text-base font-semibold tracking-tight whitespace-nowrap">
                    {formatXof(item.amountXof)}
                  </p>
                  {canManage && item.status === "pending" ? (
                    <>
                      <ActionButton
                        danger
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt("Motif du rejet (optionnel)") ?? undefined;
                          if (reason === null) return;
                          if (!window.confirm(`Rejeter ${item.ref} (${formatXof(item.amountXof)}) ?`)) return;
                          void run(() =>
                            staffApi(`/api/admin/withdrawals/${item.id}/reject`, {
                              method: "POST",
                              body: JSON.stringify({ reason: reason || undefined }),
                            }),
                          );
                        }}
                      >
                        Rejeter
                      </ActionButton>
                      <ActionButton
                        primary
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Accepter ${item.ref} (${formatXof(item.amountXof)}) ?`)) return;
                          void run(() =>
                            staffApi(`/api/admin/withdrawals/${item.id}/accept`, { method: "POST" }),
                          );
                        }}
                      >
                        Accepter
                      </ActionButton>
                    </>
                  ) : null}
                  {canManage && item.status === "approved" ? (
                    <ActionButton
                      primary
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Marquer ${item.ref} comme versé ?`)) return;
                        void run(() =>
                          staffApi(`/api/admin/withdrawals/${item.id}/mark-paid`, { method: "POST" }),
                        );
                      }}
                    >
                      Marquer versé
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
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
    status === "pending"
      ? "bg-amber-100 text-amber-800"
      : status === "approved" || status === "paid"
        ? "bg-emerald-100 text-emerald-800"
        : status === "rejected"
          ? "bg-red-100 text-red-700"
          : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
  primary,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
        primary
          ? "bg-neutral-950 text-white"
          : danger
            ? "border border-red-200 text-[#b42323]"
            : "border border-neutral-200 text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
