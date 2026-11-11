"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  isWhatsappEmbeddedOrigin,
  whatsappEmbeddedConnectUrl,
  whatsappEmbeddedOrigin,
  withBoutikAuthHash,
  workspaceUrl,
} from "@boutik/domain";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type WhatsappConfig = {
  moduleActive: boolean;
  configured: boolean;
  status: "module_off" | "not_connected" | "error" | "paused" | "live";
  phoneNumberId: string | null;
  displayPhone: string | null;
  businessAccountId: string | null;
  isEnabled: boolean;
  shopOpen: boolean;
  allowPickup: boolean;
  allowDelivery: boolean;
  welcomeMessage: string | null;
  closedMessage: string | null;
  openTime: string | null;
  closeTime: string | null;
  connectedAt: string | null;
  lastInboundAt: string | null;
  lastError: string | null;
  accessTokenMasked: string | null;
  ordersCount: number;
  webhookUrl: string;
  verifyTokenHint: string | null;
  embeddedSignup: {
    available: boolean;
    appId: string | null;
    configId: string | null;
    graphVersion: string;
    missing?: string[];
  };
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function WhatsappPage() {
  return (
    <ProShell title="WhatsApp" breadcrumb="Boutique">
      <WhatsappBody />
    </ProShell>
  );
}

function WhatsappBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsappConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isHttps, setIsHttps] = useState(true);
  const [onMetaHost, setOnMetaHost] = useState(true);
  const embeddedPublicOrigin = whatsappEmbeddedOrigin();
  const canRunMetaSdk = onMetaHost && isHttps;

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [closedMessage, setClosedMessage] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [shopOpen, setShopOpen] = useState(true);
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDelivery, setAllowDelivery] = useState(true);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe();
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      if (active.category !== "BOUTIQUE") {
        throw new Error("La boutique WhatsApp est réservée aux commerces de type Boutique.");
      }
      setTenantId(active.tenantId);
      setTenantSlug(active.slug);
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${active.tenantId}/whatsapp`);
      setConfig(payload);
      setPhoneNumberId(payload.phoneNumberId || "");
      setDisplayPhone(payload.displayPhone || "");
      setWelcomeMessage(payload.welcomeMessage || "");
      setClosedMessage(payload.closedMessage || "");
      setOpenTime(payload.openTime || "09:00");
      setCloseTime(payload.closeTime || "19:00");
      setShopOpen(payload.shopOpen);
      setAllowPickup(payload.allowPickup);
      setAllowDelivery(payload.allowDelivery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setIsHttps(window.location.protocol === "https:");
    setOnMetaHost(isWhatsappEmbeddedOrigin(window.location.origin));
  }, []);

  useEffect(() => {
    // SDK Meta uniquement sur l’hôte plateforme (pas sur admin.{slug}.*).
    if (!canRunMetaSdk || !config?.embeddedSignup.appId) return;
    const appId = config.embeddedSignup.appId;
    const version = config.embeddedSignup.graphVersion || "v21.0";
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, autoLogAppEvents: true, xfbml: false, version });
    };
    if (window.FB) {
      window.FB.init({ appId, cookie: true, autoLogAppEvents: true, xfbml: false, version });
      return;
    }
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/fr_FR/sdk.js";
    document.body.appendChild(script);
  }, [canRunMetaSdk, config?.embeddedSignup.appId, config?.embeddedSignup.graphVersion]);

  function goToMetaConnectHost() {
    const session = readProSession();
    if (!session) {
      setError("Session expirée. Reconnectez-vous, puis réessayez.");
      return;
    }
    window.location.assign(withBoutikAuthHash(whatsappEmbeddedConnectUrl(), session));
  }

  async function connectManual(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp`, {
        method: "PUT",
        body: JSON.stringify({
          phoneNumberId: phoneNumberId.trim(),
          displayPhone: displayPhone.trim() || undefined,
          accessToken: accessToken.trim(),
          isEnabled: true,
        }),
      });
      setConfig(payload);
      setAccessToken("");
      setNotice("WhatsApp connecté. Vos clients peuvent commander.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function saveShop(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp`, {
        method: "PATCH",
        body: JSON.stringify({
          shopOpen,
          allowPickup,
          allowDelivery,
          welcomeMessage: welcomeMessage.trim() || null,
          closedMessage: closedMessage.trim() || null,
          openTime: openTime.trim() || null,
          closeTime: closeTime.trim() || null,
        }),
      });
      setConfig(payload);
      setNotice("Paramètres boutique WhatsApp enregistrés.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp/test`, {
        method: "POST",
      });
      setConfig(payload);
      setNotice("Connexion Meta OK.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test de connexion échoué.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!tenantId) return;
    if (!window.confirm("Déconnecter WhatsApp de cette boutique ?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await proApi<WhatsappConfig>(`/api/workspaces/${tenantId}/whatsapp`, {
        method: "DELETE",
      });
      setConfig(payload);
      setPhoneNumberId("");
      setDisplayPhone("");
      setAccessToken("");
      setNotice("WhatsApp déconnecté.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Déconnexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  function connectEmbedded() {
    if (!tenantId || !config?.embeddedSignup.available || !config.embeddedSignup.configId) return;
    if (!canRunMetaSdk) {
      goToMetaConnectHost();
      return;
    }
    if (!window.FB) {
      setError("SDK Meta en cours de chargement. Réessayez dans quelques secondes.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    let sessionPhoneNumberId = "";
    let sessionWabaId = "";
    let sessionDisplayPhone = "";
    let authCode = "";
    let finished = false;
    let loginClosed = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
    };

    const tryComplete = async (allowCodeOnly = false) => {
      if (finished) return;
      if (!authCode) return;
      if (!allowCodeOnly && !sessionPhoneNumberId && !sessionWabaId) return;
      finished = true;
      cleanup();
      try {
        const payload = await proApi<WhatsappConfig>(
          `/api/workspaces/${tenantId}/whatsapp/embedded-signup`,
          {
            method: "POST",
            body: JSON.stringify({
              code: authCode,
              phoneNumberId: sessionPhoneNumberId || undefined,
              wabaId: sessionWabaId || undefined,
              displayPhone: sessionDisplayPhone || undefined,
            }),
          },
        );
        setConfig(payload);
        setPhoneNumberId(payload.phoneNumberId || "");
        setDisplayPhone(payload.displayPhone || "");
        setNotice(
          tenantSlug
            ? "WhatsApp connecté. Vous pouvez revenir à votre espace admin."
            : "WhatsApp connecté. Votre boutique est prête.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connexion Meta impossible.");
      } finally {
        setBusy(false);
      }
    };

    const ingestSessionPayload = (raw: unknown) => {
      let data: Record<string, unknown> | null = null;
      if (typeof raw === "string") {
        data = JSON.parse(raw) as Record<string, unknown>;
        // Certains builds Meta double-encodent.
        if (typeof data === "string") data = JSON.parse(data) as Record<string, unknown>;
      } else {
        data = raw as Record<string, unknown> | null;
      }
      if (!data || data.type !== "WA_EMBEDDED_SIGNUP") return;

      const eventName = String(data.event || "");
      const payload = (data.data || {}) as Record<string, unknown>;

      // Capturer dès qu’on a des IDs, même hors événement FINISH.
      sessionPhoneNumberId = String(
        payload.phone_number_id || payload.phoneNumberId || sessionPhoneNumberId || "",
      );
      sessionWabaId = String(payload.waba_id || payload.wabaId || sessionWabaId || "");
      const rawPhone = String(
        payload.display_phone_number || payload.displayPhoneNumber || "",
      ).replace(/[^\d+]/g, "");
      if (rawPhone) sessionDisplayPhone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

      if (
        eventName === "CANCEL" ||
        eventName === "error" ||
        eventName === "ERROR" ||
        eventName.toLowerCase() === "abort"
      ) {
        if (!finished) {
          finished = true;
          cleanup();
          setBusy(false);
          setError(
            typeof payload.error_message === "string"
              ? payload.error_message
              : "Connexion Meta annulée.",
          );
        }
        return;
      }

      const finishEvents = new Set([
        "FINISH",
        "FINISH_ONLY_WABA",
        "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      ]);
      if (finishEvents.has(eventName) || sessionPhoneNumberId || sessionWabaId) {
        void tryComplete(false);
      }
    };

    const onMessage = (event: MessageEvent) => {
      const origin = String(event.origin || "");
      // Ne pas filtrer trop strictement : certains embeds passent via facebook.net / meta.com.
      if (
        origin &&
        !origin.includes("facebook.com") &&
        !origin.includes("facebook.net") &&
        !origin.includes("meta.com")
      ) {
        return;
      }
      try {
        ingestSessionPayload(event.data);
      } catch {
        // ignore non-JSON noise from Meta SDK
      }
    };

    // Écouter AVANT d’ouvrir la popup (sinon on rate le message).
    window.addEventListener("message", onMessage);

    window.FB.login(
      (response) => {
        authCode = response.authResponse?.code || "";
        loginClosed = true;
        if (!authCode) {
          window.setTimeout(() => {
            if (finished) return;
            if (sessionPhoneNumberId || sessionWabaId) {
              void tryComplete(false);
              return;
            }
            finished = true;
            cleanup();
            setBusy(false);
            setError("Connexion Meta annulée ou incomplète.");
          }, 1200);
          return;
        }
        void tryComplete(false);
        // Le message session peut arriver après le code OAuth.
        window.setTimeout(() => {
          if (finished) return;
          if (sessionPhoneNumberId || sessionWabaId) {
            void tryComplete(false);
            return;
          }
          // Fallback : le serveur tente de découvrir WABA/numéro via le token.
          if (authCode && loginClosed) {
            void tryComplete(true);
          }
        }, 8_000);
      },
      {
        config_id: config.embeddedSignup.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
          version: "v3",
        },
      },
    );
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Chargement WhatsApp…</p>;
  }

  if (!config) {
    return <p className="text-sm text-red-600">{error || "Impossible de charger WhatsApp."}</p>;
  }

  if (!config.moduleActive) {
    return (
      <section className="rounded-[24px] bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Activez d’abord le module</h2>
        <p className="mt-2 max-w-xl text-sm text-neutral-600">
          La boutique WhatsApp est un module optionnel. Activez-le pour que vos clients commandent directement
          dans WhatsApp, puis revenez ici pour connecter votre numéro.
        </p>
        <Link
          href="/abonnement"
          className="mt-6 inline-flex rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          Aller à l’abonnement
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {onMetaHost && tenantSlug ? (
        <p className="text-sm text-neutral-600">
          <a
            href={workspaceUrl(tenantSlug, "/whatsapp")}
            className="font-medium text-neutral-950 underline underline-offset-2"
          >
            Retour à mon espace admin
          </a>
          <span className="text-neutral-400"> · admin.{tenantSlug}…</span>
        </p>
      ) : null}

      <section className="rounded-[24px] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">État de la boutique WhatsApp</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Vos clients écrivent à votre numéro → catalogue → panier → commande dans Boutik.
            </p>
          </div>
          <StatusBadge status={config.status} />
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-neutral-50 px-4 py-3">
            <dt className="text-xs text-neutral-500">Numéro</dt>
            <dd className="mt-1 font-medium">{config.displayPhone || "—"}</dd>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-4 py-3">
            <dt className="text-xs text-neutral-500">Dernier message reçu</dt>
            <dd className="mt-1 font-medium">
              {config.lastInboundAt ? formatRelative(config.lastInboundAt) : "Aucun pour l’instant"}
            </dd>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-4 py-3">
            <dt className="text-xs text-neutral-500">Commandes WhatsApp</dt>
            <dd className="mt-1 font-medium">
              {config.ordersCount}{" "}
              <Link href="/commandes?canal=whatsapp" className="text-neutral-500 underline-offset-2 hover:underline">
                voir
              </Link>
            </dd>
          </div>
        </dl>
        {config.lastError ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{config.lastError}</p>
        ) : null}
      </section>

      {!config.configured ? (
        <section className="rounded-[24px] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Connecter WhatsApp</h2>
          <p className="mt-1 text-sm text-neutral-600">
            En un clic, le commerçant lie son WhatsApp Business. Pas besoin d’ouvrir Meta Developers.
          </p>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Prérequis commerçant</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
              <li>Compte <strong className="font-semibold">Meta Business</strong></li>
              <li>
                Numéro <strong className="font-semibold">WhatsApp Business</strong> (pas un WhatsApp perso)
              </li>
              <li>
                Ne pas utiliser le <strong className="font-semibold">numéro de test Meta</strong> comme
                numéro de boutique
              </li>
            </ul>
          </div>

          {config.embeddedSignup.available ? (
            <div className="mt-5 space-y-3">
              {!canRunMetaSdk ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
                  <p className="font-medium text-neutral-950">Connexion Meta sur l’espace Boutik</p>
                  <p className="mt-1 text-neutral-600">
                    Pour éviter de déclarer chaque{" "}
                    <span className="font-mono text-xs">admin.votre-boutique…</span> chez Meta, la
                    connexion WhatsApp passe par l’origine plateforme sécurisée
                    {embeddedPublicOrigin ? (
                      <>
                        {" "}
                        (
                        <span className="font-mono text-xs break-all">{embeddedPublicOrigin}</span>
                        ).
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={goToMetaConnectHost}
                    className="mt-3 inline-flex rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Continuer vers la connexion Meta
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={connectEmbedded}
                    className="rounded-full bg-[#1877F2] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Ouverture Meta…" : "Connecter avec Meta"}
                  </button>
                  <p className="text-xs text-neutral-500">
                    Une fenêtre Meta s’ouvre : compte Facebook/Meta → Business → numéro WhatsApp
                    Business.
                  </p>
                  {tenantSlug ? (
                    <p className="text-xs text-neutral-500">
                      Après connexion, vous pourrez revenir sur{" "}
                      <a
                        href={workspaceUrl(tenantSlug, "/whatsapp")}
                        className="underline underline-offset-2"
                      >
                        votre espace admin
                      </a>
                      .
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Embedded Signup à finaliser côté plateforme</p>
              <p className="mt-1 text-neutral-600">
                Il manque encore{" "}
                {(config.embeddedSignup.missing || []).join(", ") || "la configuration Meta"} dans
                l’environnement Boutik. Dès que c’est rempli, ce bouton devient le parcours normal du
                commerçant.
              </p>
            </div>
          )}

          <details className="mt-6 rounded-2xl border border-neutral-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-neutral-800">
              Connexion avancée (support / debug)
            </summary>
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void connectManual(event)}>
              <p className="sm:col-span-2 text-xs text-neutral-500">
                Réservé aux tests techniques. Le commerçant n’a pas à passer par ici.
              </p>
              <label className="block text-sm">
                <span className="text-neutral-500">Phone Number ID</span>
                <input
                  value={phoneNumberId}
                  onChange={(event) => setPhoneNumberId(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                  placeholder="150894…"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-500">Numéro affiché (E.164)</span>
                <input
                  value={displayPhone}
                  onChange={(event) => setDisplayPhone(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                  placeholder="+225…"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-500">Access token Meta</span>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                  placeholder="EAAG…"
                  autoComplete="off"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Connexion…" : "Connecter (avancé)"}
                </button>
              </div>
            </form>
          </details>
        </section>
      ) : (
        <>
          <section className="rounded-[24px] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Connexion</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Token : <span className="font-mono text-xs">{config.accessTokenMasked}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void testConnection()}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Tester la connexion
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                >
                  Déconnecter
                </button>
              </div>
            </div>
          </section>

          <form className="rounded-[24px] bg-white p-5 sm:p-6" onSubmit={(event) => void saveShop(event)}>
            <h2 className="text-lg font-semibold tracking-tight">Gestion de la boutique</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Ouvrez / fermez WhatsApp, choisissez retrait ou livraison, personnalisez les messages.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ToggleCard
                label="Boutique ouverte"
                description="Si fermée, les clients reçoivent le message de fermeture."
                checked={shopOpen}
                onChange={setShopOpen}
              />
              <ToggleCard
                label="Retrait sur place"
                description="Proposer le retrait au checkout WhatsApp."
                checked={allowPickup}
                onChange={setAllowPickup}
              />
              <ToggleCard
                label="Livraison"
                description="Demander l’adresse au client."
                checked={allowDelivery}
                onChange={setAllowDelivery}
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-neutral-500">Ouverture (HH:MM)</span>
                <input
                  type="time"
                  value={openTime}
                  onChange={(event) => setOpenTime(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-500">Fermeture (HH:MM)</span>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(event) => setCloseTime(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-500">Message d’accueil</span>
                <textarea
                  value={welcomeMessage}
                  onChange={(event) => setWelcomeMessage(event.target.value)}
                  rows={3}
                  maxLength={700}
                  placeholder={`Bienvenue chez votre boutique…\nCommandez directement ici.`}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-neutral-500">Message si fermé</span>
                <textarea
                  value={closedMessage}
                  onChange={(event) => setClosedMessage(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Nous sommes fermés pour le moment. Réessayez demain dès 9 h."
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-5 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer la boutique"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: WhatsappConfig["status"] }) {
  const map: Record<WhatsappConfig["status"], { label: string; className: string }> = {
    module_off: { label: "Module off", className: "bg-neutral-100 text-neutral-600" },
    not_connected: { label: "À connecter", className: "bg-amber-50 text-amber-700" },
    error: { label: "Erreur", className: "bg-red-50 text-red-700" },
    paused: { label: "En pause", className: "bg-orange-50 text-orange-700" },
    live: { label: "En ligne", className: "bg-emerald-50 text-emerald-700" },
  };
  const item = map[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.className}`}>{item.label}</span>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return new Date(iso).toLocaleString("fr-FR");
}
