"use client";

import { useCallback, useEffect, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type ModuleItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  amountXof: number;
  isActive: boolean;
  categories: string[];
  categoryLabels: string[];
  activationsCount?: number;
};

type Payload = { items: ModuleItem[] };

export function ModulesPage() {
  return (
    <AdminShell title="Modules">
      <ModulesBody />
    </AdminShell>
  );
}

function ModulesBody() {
  const [data, setData] = useState<Payload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { amountXof: string; description: string }>>({});

  const canEdit = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN";

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payload, user] = await Promise.all([
        staffApi<Payload>("/api/admin/modules"),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
      setDrafts(
        Object.fromEntries(
          payload.items.map((item) => [
            item.id,
            { amountXof: String(item.amountXof), description: item.description ?? "" },
          ]),
        ),
      );
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Impossible de charger les modules.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(item: ModuleItem) {
    if (!canEdit) return;
    const draft = drafts[item.id];
    if (!draft) return;
    const amountXof = Number(draft.amountXof);
    if (!Number.isFinite(amountXof) || amountXof < 0) {
      setError("Le prix mensuel doit être un montant positif.");
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      await staffApi(`/api/admin/modules/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amountXof: Math.round(amountXof),
          description: draft.description.trim() || null,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: ModuleItem) {
    if (!canEdit) return;
    setBusyId(item.id);
    setError(null);
    try {
      await staffApi(`/api/admin/modules/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-neutral-600">
        Modules optionnels activables par les professionnels. Leur prix mensuel s’ajoute à la facture,
        indépendamment de l’abonnement.
      </p>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {!data ? (
        <p className="text-sm text-neutral-500">Chargement des modules…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun module configuré.</p>
      ) : (
        <ul className="space-y-4">
          {data.items.map((item) => {
            const draft = drafts[item.id] ?? { amountXof: String(item.amountXof), description: "" };
            const busy = busyId === item.id;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight">{item.name}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {item.isActive ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Slug <span className="font-mono">{item.slug}</span>
                      {typeof item.activationsCount === "number"
                        ? ` · ${item.activationsCount} activation${item.activationsCount > 1 ? "s" : ""}`
                        : null}
                    </p>
                    <p className="mt-2 text-sm text-neutral-600">
                      Catégories : {item.categoryLabels.join(", ")}
                    </p>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(item)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {item.isActive ? "Désactiver" : "Activer"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
                  <label className="block text-sm">
                    <span className="text-neutral-500">Description</span>
                    <textarea
                      value={draft.description}
                      disabled={!canEdit || busy}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...draft, description: event.target.value },
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 disabled:bg-neutral-50"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-neutral-500">Prix mensuel (FCFA)</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={draft.amountXof}
                      disabled={!canEdit || busy}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...draft, amountXof: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 disabled:bg-neutral-50"
                    />
                    <span className="mt-1 block text-xs text-neutral-400">{formatXof(item.amountXof)} / mois</span>
                  </label>
                </div>

                {canEdit ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void save(item)}
                      className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {busy ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
