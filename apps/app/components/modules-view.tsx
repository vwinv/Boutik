"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type ModuleItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  amountXof: number;
  activated: boolean;
  categoryLabels: string[];
};

type Payload = { items: ModuleItem[] };

type WhatsappConfig = {
  moduleActive: boolean;
  configured: boolean;
  status?: string;
  displayPhone: string | null;
};

export function ModulesPage() {
  return (
    <ProShell title="Modules" breadcrumb="Gestion">
      <ModulesBody />
    </ProShell>
  );
}

function ModulesBody() {
  const [items, setItems] = useState<ModuleItem[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsappConfig | null>(null);

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
      const payload = await proApi<Payload>(`/api/workspaces/${active.tenantId}/modules`);
      setItems(payload.items);
      const waModule = payload.items.find((item) => item.slug === "whatsapp-orders");
      if (waModule?.activated) {
        const config = await proApi<WhatsappConfig>(`/api/workspaces/${active.tenantId}/whatsapp`);
        setWhatsapp(config);
      } else {
        setWhatsapp(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les modules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(item: ModuleItem) {
    if (!tenantId) return;
    const next = !item.activated;
    const deactivateHint =
      item.slug === "sms"
        ? "Les SMS ne seront plus envoyés."
        : item.slug === "whatsapp-orders"
          ? "La boutique WhatsApp sera coupée."
          : "Le module sera désactivé.";
    const confirmMsg = next
      ? `Activer « ${item.name} » pour ${formatXof(item.amountXof)} / mois ? Ce montant s’ajoutera à votre facture.`
      : `Désactiver « ${item.name} » ? ${deactivateHint}`;
    if (!window.confirm(confirmMsg)) return;

    setBusyId(item.id);
    setError(null);
    try {
      const payload = await proApi<Payload>(`/api/workspaces/${tenantId}/modules/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: next }),
      });
      setItems(payload.items);
      if (item.slug === "whatsapp-orders") {
        if (next) {
          const config = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp`);
          setWhatsapp(config);
        } else {
          setWhatsapp(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-neutral-600">
        Options à la carte, indépendantes de votre abonnement. Une fois activées, leur prix mensuel
        s’ajoute à votre facture Boutik.
      </p>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-neutral-500">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun module disponible pour votre catégorie.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {items.map((item) => {
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight">{item.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.activated
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {item.activated ? "Activé" : "Désactivé"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {item.description || "Module optionnel Boutik."}
                  </p>
                  <p className="mt-2 text-sm font-medium text-neutral-900">
                    {formatXof(item.amountXof)}
                    <span className="font-normal text-neutral-500"> / mois</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggle(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                    item.activated
                      ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                      : "bg-neutral-950 text-white hover:bg-neutral-800"
                  }`}
                >
                  {busy ? "…" : item.activated ? "Désactiver" : "Activer"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {whatsapp ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Boutique WhatsApp</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {whatsapp.configured
                  ? `Connecté${whatsapp.displayPhone ? ` · ${whatsapp.displayPhone}` : ""}. Gérez ouverture, messages et connexion.`
                  : "Module actif — connectez votre numéro pour recevoir des commandes."}
              </p>
            </div>
            <Link
              href="/whatsapp"
              className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
            >
              {whatsapp.configured ? "Gérer WhatsApp" : "Connecter WhatsApp"}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
