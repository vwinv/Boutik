"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type EspaceItem = {
  id: string;
  name: string;
  slug: string;
  category: "BOUTIQUE" | "RESTAURANT" | "VITRINE";
  categoryLabel: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  statusLabel: string;
  planName: string;
  planTier: string;
  siteStatus: string;
  siteStatusLabel: string;
  siteHost: string;
  siteUrl: string | null;
  walletXof: number;
  professionalName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
};

type EspacesPayload = {
  kpis: {
    activeCount: number;
    totalCount: number;
    publishedCount: number;
    suspendedCount: number;
  };
  items: EspaceItem[];
};

type CategoryFilter = "ALL" | "BOUTIQUE" | "RESTAURANT" | "VITRINE";
type StatusFilter = "ALL" | "ACTIVE" | "DRAFT" | "SUSPENDED";

export function ProfessionnelsPage() {
  return (
    <AdminShell title="Professionnels & espaces">
      <ProfessionnelsBody />
    </AdminShell>
  );
}

function ProfessionnelsBody() {
  const [data, setData] = useState<EspacesPayload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selected, setSelected] = useState<EspaceItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payload, user] = await Promise.all([
        staffApi<EspacesPayload>("/api/admin/espaces"),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les espaces.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (status !== "ALL" && item.status !== status) return false;
      return true;
    });
  }, [data, category, status]);

  const canModerate = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN" || me?.staffRole === "MODERATION";

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement des professionnels…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          dark
          label="Comptes actifs"
          value={String(data.kpis.activeCount)}
          sub={`sur ${data.kpis.totalCount} espace${data.kpis.totalCount > 1 ? "s" : ""}`}
        />
        <Kpi label="Sites publiés" value={String(data.kpis.publishedCount)} sub="en ligne" />
        <Kpi
          label="Suspendus"
          value={String(data.kpis.suspendedCount)}
          sub={data.kpis.suspendedCount > 0 ? "modération" : "aucun"}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills
          value={category}
          onChange={setCategory}
          options={[
            ["ALL", "Toutes"],
            ["BOUTIQUE", "Boutique"],
            ["RESTAURANT", "Restaurant"],
            ["VITRINE", "Site vitrine"],
          ]}
        />
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            ["ALL", "Tous"],
            ["ACTIVE", "Actif"],
            ["DRAFT", "Brouillon"],
            ["SUSPENDED", "Suspendu"],
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
            <tr>
              <th className="px-5 py-3">Professionnel</th>
              <th className="px-5 py-3">Catégorie</th>
              <th className="px-5 py-3">Offre</th>
              <th className="px-5 py-3">Espace / site</th>
              <th className="px-5 py-3">Wallet</th>
              <th className="px-5 py-3">Compte</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-neutral-400">
                  Aucun espace pour ces filtres.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100">
                  <td className="px-5 py-4">
                    <p className="font-semibold tracking-tight">{item.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Inscrit le{" "}
                      {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-neutral-600">{item.categoryLabel}</td>
                  <td className="px-5 py-4">
                    <span className="font-medium">{item.planTier}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        item.siteStatus === "PUBLISHED"
                          ? "green"
                          : item.siteStatus === "SUSPENDED"
                            ? "orange"
                            : "gray"
                      }
                    >
                      {item.siteStatusLabel}
                    </Badge>
                    <p className="mt-1 text-xs text-neutral-400">{item.siteHost}</p>
                  </td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap">{formatXof(item.walletXof)}</td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        item.status === "ACTIVE" ? "green" : item.status === "SUSPENDED" ? "orange" : "gray"
                      }
                    >
                      {item.statusLabel}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-sm font-semibold"
                    >
                      Gérer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <ManageModal
          item={selected}
          busy={busy}
          canModerate={Boolean(canModerate)}
          onClose={() => setSelected(null)}
          onSuspend={() =>
            void runAction(async () => {
              const reason = window.prompt("Motif de suspension (optionnel)") ?? undefined;
              await staffApi(`/api/admin/tenants/${selected.id}/suspend`, {
                method: "POST",
                body: JSON.stringify({ reason: reason?.trim() || undefined }),
              });
            })
          }
          onReactivate={() =>
            void runAction(() =>
              staffApi(`/api/admin/tenants/${selected.id}/reactivate`, { method: "POST" }),
            )
          }
        />
      ) : null}
    </div>
  );
}

function ManageModal({
  item,
  busy,
  canModerate,
  onClose,
  onSuspend,
  onReactivate,
}: {
  item: EspaceItem;
  busy: boolean;
  canModerate: boolean;
  onClose: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">{item.name}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {item.categoryLabel} · {item.planTier} · {item.siteHost}
        </p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Compte</dt>
            <dd className="font-medium">{item.statusLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Site</dt>
            <dd className="font-medium">{item.siteStatusLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Wallet</dt>
            <dd className="font-medium">{formatXof(item.walletXof)}</dd>
          </div>
          {item.ownerEmail ? (
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Propriétaire</dt>
              <dd className="font-medium">{item.ownerName || item.ownerEmail}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Fermer
          </button>
          {canModerate && item.status === "ACTIVE" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSuspend}
              className="flex-1 rounded-2xl bg-[#b42323] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Suspendre
            </button>
          ) : null}
          {canModerate && item.status === "SUSPENDED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onReactivate}
              className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Réactiver
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
            value === key ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
          }`}
        >
          {label}
        </button>
      ))}
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

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "green" | "orange" | "gray";
}) {
  const className =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "orange"
        ? "bg-amber-100 text-amber-800"
        : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}
