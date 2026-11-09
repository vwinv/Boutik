"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TenantPublic } from "@boutik/sdk";
import {
  CHECKOUT_STEPS,
  checkoutStorageKey,
  emptyCheckout,
  paymentLabel,
  productSlugFromCartKey,
  toE164Phone,
  variantNameFromCartKey,
  type CheckoutDraft,
} from "../../lib/checkout";
import {
  clearCustomerSession,
  customerIdentityFromSession,
  readCustomerSession,
  refreshCustomerSession,
  writeCustomerSession,
  type CustomerSession,
} from "../../lib/customer-auth";
import { formatPriceXof } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { useCart } from "./cart-context";
import { CustomerAuthPopup } from "./customer-auth-popup";
import { StoreShell } from "./store-shell";

const DEFAULT_DELIVERY_FEE = 2000;

type OrderSettings = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeXof: number;
  onlinePaymentEnabled?: boolean;
};

export function CheckoutPage({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <CheckoutView tenant={tenant} basePath={basePath} />
    </StoreShell>
  );
}

function CheckoutView({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  const cart = useCart();
  const router = useRouter();
  const homeHref = storeHref(basePath, "/");
  const cartHref = storeHref(basePath, "/panier");
  const confirmHref = storeHref(basePath, "/commande/confirmee");
  const address = [tenant.site?.contact.addressLine, tenant.site?.contact.city].filter(Boolean).join(", ") || "Adresse du magasin";

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CheckoutDraft>(emptyCheckout);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [settings, setSettings] = useState<OrderSettings>({
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryFeeXof: DEFAULT_DELIVERY_FEE,
    onlinePaymentEnabled: false,
  });

  useEffect(() => {
    let nextDraft = emptyCheckout;
    try {
      const raw = window.localStorage.getItem(checkoutStorageKey(tenant.slug));
      if (raw) nextDraft = { ...emptyCheckout, ...(JSON.parse(raw) as Partial<CheckoutDraft>) };
      if (nextDraft.paymentMethod === "cod") nextDraft = { ...nextDraft, paymentMethod: "wave" };
    } catch {
      // ignore
    }
    const session = readCustomerSession(tenant.slug);
    setCustomer(session);
    if (session) {
      const identity = customerIdentityFromSession(session);
      nextDraft = {
        ...nextDraft,
        customerName: identity.name || nextDraft.customerName,
        customerEmail: identity.email || nextDraft.customerEmail,
        customerPhone: identity.phone || nextDraft.customerPhone,
      };
    }
    setDraft(nextDraft);
    setHydrated(true);
    if (new URLSearchParams(window.location.search).get("paiement") === "annule") {
      setError("Paiement annulé. Vous pouvez réessayer ou choisir un autre mode.");
      setStep(2);
    }
  }, [tenant.slug]);

  useEffect(() => {
    if (!customer) return;
    const identity = customerIdentityFromSession(customer);
    setDraft((current) => ({
      ...current,
      customerName: identity.name || current.customerName,
      customerEmail: identity.email || current.customerEmail,
      customerPhone: identity.phone || current.customerPhone,
    }));
  }, [customer]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(checkoutStorageKey(tenant.slug), JSON.stringify(draft));
  }, [draft, hydrated, tenant.slug]);

  useEffect(() => {
    void fetch(`/api/storefront/orders/settings?slug=${encodeURIComponent(tenant.slug)}`)
      .then(async (response) => {
        const body = (await response.json()) as { ok: boolean; data?: OrderSettings };
        if (body.ok && body.data) {
          setSettings(body.data);
        }
      })
      .catch(() => undefined);
  }, [tenant.slug]);

  const deliveryFee =
    draft.fulfillment === "PICKUP" ? 0 : cart.lines.length ? settings.deliveryFeeXof || DEFAULT_DELIVERY_FEE : 0;
  const total = cart.totalXof + deliveryFee;

  const loggedIn = Boolean(customer);
  const canContinue = useMemo(() => {
    if (step === 0) {
      if (loggedIn) {
        return (
          draft.customerName.trim().length >= 2 &&
          Boolean(draft.customerEmail.trim()) &&
          /^[+\d][\d\s().-]{7,24}$/.test(draft.customerPhone.trim())
        );
      }
      return draft.customerName.trim().length >= 2 && /^[+\d][\d\s().-]{7,24}$/.test(draft.customerPhone.trim());
    }
    if (step === 1) {
      if (draft.fulfillment === "PICKUP") return true;
      return draft.addressLine.trim().length >= 3;
    }
    if (step === 2) {
      if (!draft.paymentMethod) return false;
      if (
        settings.onlinePaymentEnabled &&
        draft.paymentMethod === "orange" &&
        draft.paymentOtp.trim().length < 4
      ) {
        return false;
      }
      return true;
    }
    return true;
  }, [draft, step, loggedIn, settings.onlinePaymentEnabled]);

  const hasAccountPhone = Boolean(customer?.user.phone?.trim());
  const authPrefill = useMemo(() => {
    const addressParts = [
      draft.fulfillment === "DELIVERY" ? draft.addressLine.trim() : "",
      draft.fulfillment === "DELIVERY" ? draft.city.trim() || tenant.site?.contact.city || "" : "",
    ].filter(Boolean);
    return {
      name: draft.customerName.trim(),
      phone: draft.customerPhone.trim(),
      email: draft.customerEmail.trim(),
      address: addressParts.join(", "),
    };
  }, [
    draft.addressLine,
    draft.city,
    draft.customerEmail,
    draft.customerName,
    draft.customerPhone,
    draft.fulfillment,
    tenant.site?.contact.city,
  ]);

  function requestPlaceOrder() {
    setError(null);
    const session = readCustomerSession(tenant.slug) || customer;
    if (!session?.accessToken) {
      clearCustomerSession(tenant.slug);
      setCustomer(null);
      setAuthOpen(true);
      return;
    }
    void placeOrder(session);
  }

  async function placeOrder(session: CustomerSession, didRefresh = false) {
    setPending(true);
    setError(null);
    try {
      const identity = customerIdentityFromSession(session);
      const phone = toE164Phone(draft.customerPhone.trim() || identity.phone);
      if (!identity.name || identity.name.length < 2) {
        setError("Votre compte client n’a pas de nom valide. Reconnectez-vous ou mettez à jour votre profil.");
        return;
      }
      if (!identity.email) {
        setError("Votre compte client n’a pas d’email.");
        return;
      }
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        setError("Indiquez un numéro de téléphone valide (ex. +225 07 00 11 22).");
        setStep(0);
        return;
      }
      let activeSession = session;
      if (!identity.phone && phone) {
        activeSession = {
          ...session,
          user: { ...session.user, phone },
        };
        writeCustomerSession(tenant.slug, activeSession);
        setCustomer(activeSession);
      }
      if (!activeSession.accessToken?.trim()) {
        clearCustomerSession(tenant.slug);
        setCustomer(null);
        setAuthOpen(true);
        setError("Reconnectez-vous pour finaliser la commande.");
        return;
      }
      const origin = window.location.origin;
      const payload = {
        fulfillment: draft.fulfillment,
        customerName: identity.name,
        customerPhone: phone,
        customerEmail: identity.email,
        addressLine: draft.fulfillment === "DELIVERY" ? draft.addressLine.trim() : null,
        city: draft.fulfillment === "DELIVERY" ? draft.city.trim() || tenant.site?.contact.city || "Abidjan" : null,
        note: [draft.note.trim(), `Paiement: ${paymentLabel(draft.paymentMethod)}`].filter(Boolean).join(" · ") || null,
        paymentMethod: draft.paymentMethod,
        paymentOtp: draft.paymentMethod === "orange" ? draft.paymentOtp.trim() || null : null,
        returnUrl: `${origin}${confirmHref}`,
        cancelUrl: `${origin}${storeHref(basePath, "/commande")}?paiement=annule`,
        items: cart.lines.map((line) => {
          const fromKey = variantNameFromCartKey(line.slug);
          return {
            productSlug: productSlugFromCartKey(line.slug),
            quantity: line.quantity,
            variantId: line.variantId || null,
            variantName: line.variantName || fromKey,
          };
        }),
      };
      const response = await fetch(`/api/storefront/orders?slug=${encodeURIComponent(tenant.slug)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          number: string;
          totalXof: number;
          paymentUrl?: string | null;
          paymentStatus?: string;
          paymentMessage?: string | null;
          awaitCustomerConfirmation?: boolean;
        };
        error?: { message?: string; code?: string };
      };

      if ((!body.ok || !body.data?.number) && (response.status === 401 || body.error?.code === "UNAUTHORIZED")) {
        if (!didRefresh) {
          const refreshed = await refreshCustomerSession(tenant.slug, activeSession);
          if (refreshed) {
            setCustomer(refreshed);
            await placeOrder(refreshed, true);
            return;
          }
        }
        clearCustomerSession(tenant.slug);
        setCustomer(null);
        setAuthOpen(true);
        setError("Session expirée — reconnectez-vous pour finaliser la commande.");
        return;
      }

      if (!body.ok || !body.data?.number) {
        setError(body.error?.message || "Impossible de valider la commande pour le moment.");
        return;
      }

      window.sessionStorage.setItem(
        `boutik.order.${tenant.slug}`,
        JSON.stringify({
          number: body.data.number,
          totalXof: body.data.totalXof ?? total,
          fulfillment: draft.fulfillment,
          payment: paymentLabel(draft.paymentMethod),
          paymentStatus: body.data.paymentStatus ?? null,
          paymentMessage: body.data.paymentMessage ?? null,
          awaitCustomerConfirmation: body.data.awaitCustomerConfirmation ?? false,
        }),
      );
      cart.clear();
      window.localStorage.removeItem(checkoutStorageKey(tenant.slug));

      if (body.data.paymentUrl) {
        window.location.assign(body.data.paymentUrl);
        return;
      }
      router.push(confirmHref);
    } catch {
      setError("Impossible de valider la commande pour le moment.");
    } finally {
      setPending(false);
    }
  }

  if (!cart.lines.length && hydrated) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Finaliser la commande</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--site-muted)" }}>
          Votre panier est vide.
        </p>
        <Link href={cartHref} className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white">
          Voir le panier
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <CheckoutStepper step={step} />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Finaliser la commande</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.75fr)] lg:items-start">
        <section>
          {step === 0 ? (
            <div className="grid gap-4">
              {loggedIn ? (
                <p className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--site-border)", background: "var(--site-card)" }}>
                  Connecté en tant que <span className="font-medium">{customer?.user.name}</span>
                  <span className="mt-1 block text-xs" style={{ color: "var(--site-muted)" }}>
                    {hasAccountPhone
                      ? "Nom, téléphone et email viennent de votre compte."
                      : "Nom et email viennent de votre compte — indiquez votre téléphone pour continuer."}
                  </span>
                </p>
              ) : (
                <p className="text-sm" style={{ color: "var(--site-muted)" }}>
                  Vous vous connecterez à l’étape suivante ; la commande utilisera alors les infos de votre compte client.
                </p>
              )}
              <Field
                label="Nom complet *"
                value={draft.customerName}
                readOnly={loggedIn}
                autoComplete="off"
                onChange={(customerName) => setDraft((current) => ({ ...current, customerName }))}
              />
              <Field
                label="Téléphone *"
                value={draft.customerPhone}
                placeholder="+225…"
                readOnly={loggedIn && hasAccountPhone}
                autoComplete="tel"
                onChange={(customerPhone) => setDraft((current) => ({ ...current, customerPhone }))}
              />
              <Field
                label="Email"
                hint={loggedIn ? "issu de votre compte" : "sera celui de votre compte à la connexion"}
                type="email"
                value={draft.customerEmail}
                readOnly={loggedIn}
                autoComplete="off"
                onChange={(customerEmail) => setDraft((current) => ({ ...current, customerEmail }))}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              {settings.deliveryEnabled ? (
                <OptionCard
                  selected={draft.fulfillment === "DELIVERY"}
                  title={`Livraison · ${tenant.site?.contact.city || "Abidjan"} sous 24 h · ${settings.deliveryFeeXof.toLocaleString("fr-FR")} FCFA`}
                  onSelect={() => setDraft((current) => ({ ...current, fulfillment: "DELIVERY" }))}
                />
              ) : null}
              {settings.pickupEnabled ? (
                <OptionCard
                  selected={draft.fulfillment === "PICKUP"}
                  title={`Retrait sur place · ${address} · gratuit`}
                  onSelect={() => setDraft((current) => ({ ...current, fulfillment: "PICKUP" }))}
                />
              ) : null}
              {draft.fulfillment === "DELIVERY" ? (
                <>
                  <Field
                    label="Adresse de livraison *"
                    placeholder="Quartier, rue, point de repère"
                    value={draft.addressLine}
                    onChange={(addressLine) => setDraft((current) => ({ ...current, addressLine }))}
                  />
                  <Field
                    label="Ville"
                    value={draft.city}
                    placeholder={tenant.site?.contact.city || "Abidjan"}
                    onChange={(city) => setDraft((current) => ({ ...current, city }))}
                  />
                </>
              ) : null}
              <label className="block">
                <span className="text-sm font-medium">Note pour le vendeur</span>
                <textarea
                  rows={3}
                  value={draft.note}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                  className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: "var(--site-border)",
                    background: "var(--site-card)",
                    color: "var(--site-fg)",
                  }}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["wave", "Wave"],
                  ["orange", "Orange Money"],
                  ["mtn", "MTN MoMo"],
                ] as const
              ).map(([value, label]) => (
                <OptionCard
                  key={value}
                  selected={draft.paymentMethod === value}
                  title={label}
                  onSelect={() =>
                    setDraft((current) => ({
                      ...current,
                      paymentMethod: value,
                      paymentOtp: value === "orange" ? current.paymentOtp : "",
                    }))
                  }
                />
              ))}
              {settings.onlinePaymentEnabled && draft.paymentMethod === "orange" ? (
                <label className="sm:col-span-2 block">
                  <span className="text-sm font-medium">Code OTP Orange Money</span>
                  <p className="mt-1 text-xs" style={{ color: "var(--site-muted)" }}>
                    Composez <strong>#144*82#</strong> puis option 2 pour obtenir le code.
                  </p>
                  <input
                    value={draft.paymentOtp}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        paymentOtp: event.target.value.replace(/[^\d]/g, "").slice(0, 8),
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Ex. 8562"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--site-border)",
                      background: "var(--site-card)",
                      color: "var(--site-fg)",
                    }}
                  />
                </label>
              ) : null}
              {settings.onlinePaymentEnabled ? (
                <p className="sm:col-span-2 text-xs" style={{ color: "var(--site-muted)" }}>
                  Paiement mobile en ligne — le montant est prélevé immédiatement.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rounded-[24px] p-5 sm:p-6" style={{ background: "var(--site-card)" }}>
              <p className="text-sm">
                <span style={{ color: "var(--site-muted)" }}>Client · </span>
                {draft.customerName} · {draft.customerPhone}
              </p>
              <p className="mt-3 text-sm">
                <span style={{ color: "var(--site-muted)" }}>Mode · </span>
                {draft.fulfillment === "PICKUP" ? "Retrait sur place" : `Livraison · ${draft.addressLine || "—"}`}
              </p>
              <p className="mt-3 text-sm">
                <span style={{ color: "var(--site-muted)" }}>Paiement · </span>
                {paymentLabel(draft.paymentMethod)}
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step === 0 ? (
              <Link
                href={cartHref}
                className="rounded-full border px-5 py-3 text-sm font-medium"
                style={{ borderColor: "var(--site-border)" }}
              >
                Retour
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="rounded-full border px-5 py-3 text-sm font-medium"
                style={{ borderColor: "var(--site-border)" }}
              >
                Retour
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((value) => Math.min(3, value + 1))}
                className="rounded-full px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
                style={{ background: "var(--site-primary)" }}
              >
                Continuer
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={requestPlaceOrder}
                className="rounded-full px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--site-primary)" }}
              >
                {pending
                  ? "Validation…"
                  : settings.onlinePaymentEnabled
                    ? `Payer · ${formatPriceXof(total)}`
                    : `Commander · ${formatPriceXof(total)}`}
              </button>
            )}
          </div>
          {step === 3 && !customer ? (
            <p className="mt-3 text-xs" style={{ color: "var(--site-muted)" }}>
              Un compte client est requis pour finaliser la commande.
            </p>
          ) : null}
        </section>

        <aside className="rounded-[24px] p-5 sm:p-6" style={{ background: "var(--site-card)" }}>
          <p className="text-sm font-semibold">Récapitulatif</p>
          <ul className="mt-4 space-y-3">
            {cart.lines.map((line) => (
              <li key={line.slug} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  {line.quantity} × {line.name}
                </span>
                <span className="shrink-0 font-medium">{formatPriceXof(line.priceXof * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span style={{ color: "var(--site-muted)" }}>Livraison</span>
            <span className="font-medium">{deliveryFee ? formatPriceXof(deliveryFee) : "Offerts"}</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-4 font-semibold" style={{ borderColor: "var(--site-border)" }}>
            <span>Total</span>
            <span>{formatPriceXof(total)}</span>
          </div>
          <Link href={homeHref} className="mt-4 block text-center text-xs" style={{ color: "var(--site-muted)" }}>
            Continuer mes achats
          </Link>
        </aside>
      </div>

      <CustomerAuthPopup
        open={authOpen}
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        layoutKey={tenant.site?.theme?.layoutKey}
        prefill={authPrefill}
        onClose={() => setAuthOpen(false)}
        onSuccess={(session) => {
          const identity = customerIdentityFromSession(session);
          setCustomer(session);
          setAuthOpen(false);
          setDraft((current) => ({
            ...current,
            customerName: identity.name || current.customerName,
            customerEmail: identity.email || current.customerEmail,
            customerPhone: identity.phone || current.customerPhone,
          }));
          void placeOrder(session);
        }}
      />
    </main>
  );
}

function CheckoutStepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {CHECKOUT_STEPS.map((label, index) => {
        const active = index <= step;
        return (
          <li key={label} className="min-w-0">
            <p className={`truncate text-xs font-medium sm:text-sm ${active ? "" : "opacity-45"}`}>{label}</p>
            <span
              className="mt-2 block h-1 rounded-full"
              style={{ background: active ? "var(--site-primary)" : "var(--site-border)" }}
            />
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  autoComplete?: string;
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
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete={autoComplete}
        onChange={(event) => {
          if (readOnly) return;
          onChange(event.target.value);
        }}
        className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none disabled:opacity-80"
        style={{
          borderColor: "var(--site-border)",
          background: readOnly ? "color-mix(in srgb, var(--site-card) 70%, var(--site-border))" : "var(--site-card)",
          color: "var(--site-fg)",
        }}
      />
    </label>
  );
}

function OptionCard({
  selected,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left"
      style={{
        borderColor: selected ? "var(--site-primary)" : "var(--site-border)",
        background: selected
          ? "color-mix(in srgb, var(--site-primary) 18%, var(--site-card))"
          : "var(--site-card)",
      }}
    >
      <span
        className="mt-0.5 grid size-5 place-items-center rounded-full border-2"
        style={{ borderColor: selected ? "var(--site-primary)" : "var(--site-border)" }}
      >
        {selected ? <span className="size-2.5 rounded-full" style={{ background: "var(--site-primary)" }} /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs" style={{ color: "var(--site-muted)" }}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}
