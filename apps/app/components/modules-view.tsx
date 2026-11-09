"use client";

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
  phoneNumberId: string | null;
  displayPhone: string | null;
  businessAccountId: string | null;
  isEnabled: boolean;
  connectedAt: string | null;
  lastError: string | null;
  accessTokenMasked: string | null;
  webhookUrl: string;
  verifyTokenHint: string | null;
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

      {whatsapp && tenantId ? (
        <WhatsappConfigPanel
          tenantId={tenantId}
          initial={whatsapp}
          onSaved={(next) => setWhatsapp(next)}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function WhatsappConfigPanel({
  tenantId,
  initial,
  onSaved,
  onError,
}: {
  tenantId: string;
  initial: WhatsappConfig;
  onSaved: (value: WhatsappConfig) => void;
  onError: (value: string | null) => void;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(initial.phoneNumberId ?? "");
  const [displayPhone, setDisplayPhone] = useState(initial.displayPhone ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState(initial.businessAccountId ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPhoneNumberId(initial.phoneNumberId ?? "");
    setDisplayPhone(initial.displayPhone ?? "");
    setBusinessAccountId(initial.businessAccountId ?? "");
  }, [initial]);

  async function saveProper(event: React.FormEvent) {
    event.preventDefault();
    if (!phoneNumberId.trim()) {
      onError("Le Phone Number ID Meta est requis.");
      return;
    }
    if (!accessToken.trim()) {
      onError(
        initial.configured
          ? "Pour modifier la config, renseignez à nouveau le token d’accès (non stocké en clair côté interface)."
          : "Le token d’accès WhatsApp est requis.",
      );
      return;
    }
    setBusy(true);
    onError(null);
    setNotice(null);
    try {
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp`, {
        method: "PUT",
        body: JSON.stringify({
          phoneNumberId: phoneNumberId.trim(),
          displayPhone: displayPhone.trim() || undefined,
          accessToken: accessToken.trim(),
          businessAccountId: businessAccountId.trim() || undefined,
          isEnabled: true,
        }),
      });
      onSaved(payload);
      setAccessToken("");
      setNotice("Configuration WhatsApp enregistrée.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Enregistrement WhatsApp impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Configuration WhatsApp</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Branchez votre numéro WhatsApp Business Cloud API pour que vos clients commandent dans WhatsApp.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            initial.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {initial.configured ? "Connecté" : "À configurer"}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p>
          Webhook URL : <span className="font-mono text-neutral-900">{initial.webhookUrl}</span>
        </p>
        <p className="mt-1">{initial.verifyTokenHint}</p>
        {initial.accessTokenMasked ? (
          <p className="mt-1">Token actuel : <span className="font-mono">{initial.accessTokenMasked}</span></p>
        ) : null}
      </div>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void saveProper(event)}>
        <label className="block text-sm sm:col-span-1">
          <span className="text-neutral-500">Phone Number ID</span>
          <input
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Ex. 123456789012345"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-500">Numéro affiché (E.164)</span>
          <input
            value={displayPhone}
            onChange={(event) => setDisplayPhone(event.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="+22177…"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-neutral-500">Access token Meta</span>
          <input
            type="password"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder={initial.configured ? "Coller un nouveau token pour mettre à jour" : "EAAG…"}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-neutral-500">WhatsApp Business Account ID (optionnel)</span>
          <input
            value={businessAccountId}
            onChange={(event) => setBusinessAccountId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        {notice ? <p className="sm:col-span-2 text-sm text-emerald-700">{notice}</p> : null}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer WhatsApp"}
          </button>
        </div>
      </form>
    </section>
  );
}
