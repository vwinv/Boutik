"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { TenantPublic } from "@boutik/sdk";
import {
  clearCustomerSession,
  customerAuthRequest,
  customerAuthedRequest,
  readCustomerSession,
  writeCustomerSession,
  type CustomerSession,
} from "../../lib/customer-auth";
import { toE164Phone } from "../../lib/checkout";
import { storeHref } from "../../lib/store-paths";
import { formatPriceXof, isDarkHeroLayout, resolveLayout } from "../../lib/theme";
import { StoreShell } from "./store-shell";

type Mode = "login" | "register";

type CustomerOrder = {
  id: string;
  number: string;
  status: string;
  fulfillment: string;
  totalXof: number;
  createdAt: string;
  items: Array<{ productName: string; quantity: number }>;
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARING: "En préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  PICKED_UP: "Récupérée",
  CANCELLED: "Annulée",
};

export function AccountPage({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <AccountView tenant={tenant} basePath={basePath} />
    </StoreShell>
  );
}

function AccountView({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  const homeHref = storeHref(basePath, "/");
  const boutiqueHref = storeHref(basePath, "/#boutique");
  const layout = resolveLayout(tenant.site?.theme?.layoutKey);
  const darkHero = isDarkHeroLayout(layout);
  const [mode, setMode] = useState<Mode>("login");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    setSession(readCustomerSession(tenant.slug));
    setHydrated(true);
  }, [tenant.slug]);

  useEffect(() => {
    if (!session?.user) return;
    setEditName(session.user.name ?? "");
    setEditPhone(session.user.phone ?? "");
  }, [session?.user]);

  useEffect(() => {
    if (!session?.accessToken) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    setOrdersLoading(true);
    void fetch(`/api/storefront/orders/mine?slug=${encodeURIComponent(tenant.slug)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then(async (response) => {
        const body = (await response.json()) as { ok: boolean; data?: CustomerOrder[] };
        if (!cancelled && body.ok && Array.isArray(body.data)) {
          setOrders(body.data);
        }
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, tenant.slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        password,
        tenantSlug: tenant.slug,
      };
      const data =
        mode === "register"
          ? await customerAuthRequest<{
              accessToken: string;
              refreshToken: string;
              expiresIn: number;
              user: { id: string; name: string; email: string; phone?: string | null };
            }>("customers/register", {
              ...payload,
              name: name.trim(),
              ...(phone.trim() ? { phone: toE164Phone(phone.trim()) } : {}),
            })
          : await customerAuthRequest<{
              accessToken: string;
              refreshToken: string;
              expiresIn: number;
              user: { id: string; name: string; email: string; phone?: string | null };
            }>("customers/login", payload);
      const next: CustomerSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone ?? null,
        },
      };
      writeCustomerSession(tenant.slug, next);
      setSession(next);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError(null);
    try {
      if (session?.refreshToken) {
        await customerAuthRequest("logout", { refreshToken: session.refreshToken }).catch(() => undefined);
      }
    } finally {
      clearCustomerSession(tenant.slug);
      setSession(null);
      setPending(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    const nextName = editName.trim();
    const nextPhone = toE164Phone(editPhone.trim());
    if (nextName.length < 2) {
      setError("Le nom doit contenir au moins 2 caractères.");
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(nextPhone)) {
      setError("Indiquez un numéro valide (ex. +225 07 00 11 22).");
      return;
    }
    setProfileSaving(true);
    setError(null);
    setProfileNotice(null);
    try {
      const data = await customerAuthedRequest<{
        user: { id: string; name: string; email: string; phone?: string | null };
      }>(tenant.slug, "/api/me", {
        method: "PATCH",
        body: JSON.stringify({ name: nextName, phone: nextPhone }),
      });
      const next: CustomerSession = {
        ...session,
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone ?? null,
        },
      };
      writeCustomerSession(tenant.slug, next);
      setSession(next);
      setProfileNotice("Profil mis à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer le profil.");
    } finally {
      setProfileSaving(false);
    }
  }

  if (!hydrated) {
    return <main className="min-h-[50vh]" />;
  }

  if (session) {
    const initials = initialsFromName(session.user.name);
    const phoneDisplay = session.user.phone?.trim() || null;
    return (
      <main className="pb-16">
        <section
          className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-14"
          style={
            darkHero
              ? { background: "var(--site-hero)", color: "var(--site-hero-fg)" }
              : { background: "var(--site-bg)", color: "var(--site-fg)" }
          }
        >
          {darkHero ? (
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl motion-safe:animate-pulse"
              style={{ background: "color-mix(in srgb, #fff 35%, transparent)" }}
            />
          ) : null}
          <div className="relative mx-auto flex max-w-3xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="boutik-account-rise">
              <p
                className="text-xs font-medium tracking-[0.18em] uppercase"
                style={{ color: darkHero ? "var(--site-hero-muted)" : "var(--site-muted)" }}
              >
                {tenant.name}
              </p>
              <div className="mt-5 flex items-center gap-4">
                <span
                  className="grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold tracking-tight sm:size-16 sm:text-xl"
                  style={
                    darkHero
                      ? { background: "#fff", color: "#171717" }
                      : { background: "var(--site-primary)", color: "#fff" }
                  }
                >
                  {initials}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{session.user.name}</h1>
                  <p
                    className="mt-1.5 text-sm"
                    style={{ color: darkHero ? "var(--site-hero-muted)" : "var(--site-muted)" }}
                  >
                    {session.user.email}
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: darkHero ? "var(--site-hero-muted)" : "var(--site-muted)" }}
                  >
                    {phoneDisplay ?? "Aucun téléphone renseigné"}
                  </p>
                </div>
              </div>
            </div>
            <div className="boutik-account-rise flex flex-wrap gap-3" style={{ animationDelay: "80ms" }}>
              <Link
                href={boutiqueHref}
                className="rounded-full px-5 py-3 text-sm font-medium"
                style={
                  darkHero
                    ? { background: "#fff", color: "#171717" }
                    : { background: "var(--site-primary)", color: "#fff" }
                }
              >
                Continuer mes achats
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => void logout()}
                className="rounded-full border px-5 py-3 text-sm font-medium disabled:opacity-50"
                style={
                  darkHero
                    ? { borderColor: "rgba(255,255,255,0.35)", color: "#fff" }
                    : { borderColor: "var(--site-border)", background: "#fff", color: "var(--site-fg)" }
                }
              >
                Se déconnecter
              </button>
            </div>
          </div>
          {!darkHero ? (
            <div className="mx-auto mt-10 max-w-3xl border-b" style={{ borderColor: "var(--site-border)" }} />
          ) : null}
        </section>

        <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: "var(--site-muted)" }}>
              Profil
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Mes informations</h2>
          </div>
          <form
            className="mt-6 grid gap-4 overflow-hidden rounded-[28px] p-5 sm:p-6"
            style={{
              background: "var(--site-card)",
              border: darkHero ? undefined : "1px solid var(--site-border)",
            }}
            onSubmit={(event) => void saveProfile(event)}
          >
            <LightField label="Nom complet" value={editName} onChange={setEditName} autoComplete="name" required />
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={session.user.email}
                readOnly
                className="mt-2 w-full rounded-2xl border bg-black/[0.03] px-4 py-3 text-sm outline-none"
                style={{ borderColor: "var(--site-border)", color: "var(--site-muted)" }}
              />
              <span className="mt-1 block text-xs" style={{ color: "var(--site-muted)" }}>
                L’email sert à vous connecter et ne peut pas être modifié ici.
              </span>
            </label>
            <LightField
              label="Téléphone"
              value={editPhone}
              onChange={setEditPhone}
              autoComplete="tel"
              hint="Format international, ex. +225 07 00 11 22"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {profileNotice ? <p className="text-sm text-emerald-700">{profileNotice}</p> : null}
            <button
              type="submit"
              disabled={profileSaving}
              className="mt-1 w-full rounded-full px-5 py-3.5 text-sm font-medium text-white transition-opacity disabled:opacity-60 sm:w-auto sm:justify-self-start"
              style={{ background: "var(--site-primary)" }}
            >
              {profileSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </section>

        <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: "var(--site-muted)" }}>
                Historique
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Mes commandes</h2>
            </div>
            {!ordersLoading && orders.length > 0 ? (
              <p className="text-sm tabular-nums" style={{ color: "var(--site-muted)" }}>
                {orders.length} commande{orders.length > 1 ? "s" : ""}
              </p>
            ) : null}
          </div>

          {ordersLoading ? (
            <div className="mt-8 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-[22px]" style={{ background: "var(--site-card)" }} />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div
              className="mt-8 overflow-hidden rounded-[28px] px-6 py-10 text-center sm:px-10"
              style={{ background: "var(--site-card)", border: darkHero ? undefined : "1px solid var(--site-border)" }}
            >
              <p className="text-lg font-semibold tracking-tight">Aucune commande pour l’instant</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
                Vos prochaines commandes chez {tenant.name} apparaîtront ici, liées à votre compte.
              </p>
              <Link
                href={boutiqueHref}
                className="mt-6 inline-flex rounded-full px-5 py-3 text-sm font-medium text-white"
                style={{ background: "var(--site-primary)" }}
              >
                Voir la boutique
              </Link>
            </div>
          ) : (
            <ul
              className="mt-8 divide-y overflow-hidden rounded-[28px]"
              style={{
                background: "var(--site-card)",
                border: darkHero ? undefined : "1px solid var(--site-border)",
              }}
            >
              {orders.map((order, index) => {
                const summary = order.items
                  .slice(0, 2)
                  .map((item) => `${item.productName}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`)
                  .join(" · ");
                const extra = order.items.length > 2 ? ` +${order.items.length - 2}` : "";
                return (
                  <li
                    key={order.id}
                    className="boutik-account-rise px-5 py-5 sm:px-6"
                    style={{
                      animationDelay: `${Math.min(index, 6) * 50}ms`,
                      borderColor: "var(--site-border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold tracking-tight">#{order.number}</p>
                          <StatusPill status={order.status} />
                        </div>
                        <p className="mt-1.5 text-sm" style={{ color: "var(--site-muted)" }}>
                          {formatOrderDate(order.createdAt)}
                          {" · "}
                          {order.fulfillment === "DELIVERY" ? "Livraison" : "Retrait"}
                        </p>
                        {summary ? (
                          <p className="mt-2 truncate text-sm" style={{ color: "var(--site-muted)" }}>
                            {summary}
                            {extra}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-right text-base font-semibold tracking-tight tabular-nums">
                        {formatPriceXof(order.totalXof)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <AccountMotionStyles />
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden pb-16">
      {darkHero ? (
        <DarkAuthPanel
          tenantName={tenant.name}
          mode={mode}
          setMode={setMode}
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          pending={pending}
          error={error}
          setError={setError}
          homeHref={homeHref}
          onSubmit={submit}
        />
      ) : (
        <LightAuthPanel
          tenantName={tenant.name}
          mode={mode}
          setMode={setMode}
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          pending={pending}
          error={error}
          setError={setError}
          homeHref={homeHref}
          onSubmit={submit}
        />
      )}
      <AccountMotionStyles />
    </main>
  );
}

function LightAuthPanel({
  tenantName,
  mode,
  setMode,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  pending,
  error,
  setError,
  homeHref,
  onSubmit,
}: AuthPanelProps) {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="boutik-account-rise mx-auto max-w-md">
        <p className="text-center text-xs font-medium tracking-[0.2em] uppercase" style={{ color: "var(--site-muted)" }}>
          {tenantName}
        </p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {mode === "login" ? "Bon retour" : "Créer un compte"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
          {mode === "login"
            ? "Connectez-vous pour retrouver vos commandes et commander plus vite."
            : "Créez votre compte client pour finaliser vos commandes et suivre vos achats."}
        </p>

        <div
          className="mt-8 overflow-hidden rounded-[28px] border p-5 sm:p-7"
          style={{ borderColor: "var(--site-border)", background: "var(--site-card)" }}
        >
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-1">
            <LightModeTab
              active={mode === "login"}
              label="Connexion"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            />
            <LightModeTab
              active={mode === "register"}
              label="Inscription"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            />
          </div>

          <form className="mt-6 grid gap-4" onSubmit={(event) => void onSubmit(event)}>
            {mode === "register" ? (
              <LightField label="Nom complet" value={name} onChange={setName} autoComplete="name" required />
            ) : null}
            {mode === "register" ? (
              <LightField
                label="Téléphone"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                hint="Ex. +225 07 00 11 22"
              />
            ) : null}
            <LightField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <LightField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              hint={mode === "register" ? "8 caractères minimum" : undefined}
              required
              minLength={mode === "register" ? 8 : 1}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-full px-5 py-3.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: "var(--site-primary)" }}
            >
              {pending ? "Patientez…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--site-muted)" }}>
          <Link href={homeHref} className="underline-offset-4 hover:underline">
            Retour à la boutique
          </Link>
        </p>
      </div>
    </section>
  );
}

function DarkAuthPanel({
  tenantName,
  mode,
  setMode,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  pending,
  error,
  setError,
  homeHref,
  onSubmit,
}: AuthPanelProps) {
  return (
    <section
      className="relative px-4 py-12 sm:px-6 sm:py-16"
      style={{ background: "var(--site-hero)", color: "var(--site-hero-fg)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 size-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl motion-safe:animate-pulse"
        style={{ background: "color-mix(in srgb, #fff 40%, transparent)" }}
      />
      <div className="boutik-account-rise relative mx-auto max-w-md">
        <p className="text-center text-xs font-medium tracking-[0.2em] uppercase" style={{ color: "var(--site-hero-muted)" }}>
          {tenantName}
        </p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {mode === "login" ? "Bon retour" : "Rejoindre"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed" style={{ color: "var(--site-hero-muted)" }}>
          {mode === "login"
            ? "Connectez-vous pour retrouver vos commandes et commander plus vite."
            : "Créez votre compte client pour finaliser vos commandes et suivre vos achats."}
        </p>

        <div className="mt-8 overflow-hidden rounded-[28px] bg-white/10 p-5 backdrop-blur-md sm:p-7">
          <div className="flex gap-1 rounded-full bg-black/15 p-1">
            <DarkModeTab
              active={mode === "login"}
              label="Connexion"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            />
            <DarkModeTab
              active={mode === "register"}
              label="Inscription"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            />
          </div>

          <form className="mt-6 grid gap-4" onSubmit={(event) => void onSubmit(event)}>
            {mode === "register" ? (
              <DarkField label="Nom complet" value={name} onChange={setName} autoComplete="name" required />
            ) : null}
            {mode === "register" ? (
              <DarkField
                label="Téléphone"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                hint="Ex. +225 07 00 11 22"
              />
            ) : null}
            <DarkField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <DarkField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              hint={mode === "register" ? "8 caractères minimum" : undefined}
              required
              minLength={mode === "register" ? 8 : 1}
            />
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-full bg-white px-5 py-3.5 text-sm font-medium text-neutral-950 transition-opacity disabled:opacity-60"
            >
              {pending ? "Patientez…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--site-hero-muted)" }}>
          <Link href={homeHref} className="underline-offset-4 hover:underline">
            Retour à la boutique
          </Link>
        </p>
      </div>
    </section>
  );
}

type AuthPanelProps = {
  tenantName: string;
  mode: Mode;
  setMode: (mode: Mode) => void;
  name: string;
  setName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  pending: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  homeHref: string;
  onSubmit: (event: FormEvent) => void;
};

function StatusPill({ status }: { status: string }) {
  const label = ORDER_STATUS_LABEL[status] || status;
  const cancelled = status === "CANCELLED";
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide"
      style={
        cancelled
          ? { background: "rgba(23,23,23,0.08)", color: "rgba(23,23,23,0.55)" }
          : { background: "color-mix(in srgb, var(--site-primary) 12%, white)", color: "var(--site-primary)" }
      }
    >
      {label}
    </span>
  );
}

function LightModeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
      style={active ? { background: "#fff", color: "#171717", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "var(--site-muted)" }}
    >
      {label}
    </button>
  );
}

function DarkModeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
      style={active ? { background: "#fff", color: "#171717" } : { color: "var(--site-hero-muted)" }}
    >
      {label}
    </button>
  );
}

function LightField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs" style={{ color: "var(--site-muted)" }}>
          {hint}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        style={{ borderColor: "var(--site-border)", color: "var(--site-fg)" }}
      />
    </label>
  );
}

function DarkField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs" style={{ color: "var(--site-hero-muted)" }}>
          {hint}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-neutral-950 outline-none ring-0"
      />
    </label>
  );
}

function AccountMotionStyles() {
  return (
    <style>{`
      @keyframes boutikAccountRise {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: no-preference) {
        .boutik-account-rise {
          animation: boutikAccountRise 0.55s ease-out both;
        }
      }
    `}</style>
  );
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatOrderDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
