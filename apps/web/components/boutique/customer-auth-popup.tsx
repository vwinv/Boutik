"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  customerAuthRequest,
  writeCustomerSession,
  type CustomerSession,
} from "../../lib/customer-auth";
import { toE164Phone } from "../../lib/checkout";
import { isDarkHeroLayout, resolveLayout } from "../../lib/theme";

export type CustomerAuthPrefill = {
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
};

type Mode = "login" | "register";

export function CustomerAuthPopup({
  open,
  tenantSlug,
  tenantName,
  layoutKey,
  prefill,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tenantSlug: string;
  tenantName: string;
  layoutKey?: string | null;
  prefill?: CustomerAuthPrefill;
  onClose: () => void;
  onSuccess: (session: CustomerSession) => void;
}) {
  const titleId = useId();
  const darkHero = isDarkHeroLayout(resolveLayout(layoutKey));
  const [mode, setMode] = useState<Mode>("register");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    const split = splitFullName(prefill?.name || "");
    setFirstName(prefill?.firstName?.trim() || split.firstName);
    setLastName(prefill?.lastName?.trim() || split.lastName);
    setPhone(prefill?.phone?.trim() || "");
    setEmail(prefill?.email?.trim() || "");
    setAddress(prefill?.address?.trim() || "");
    setPassword("");
    setError(null);
    setMode("register");
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Indiquez votre e-mail.");
      if (password.length < (mode === "register" ? 8 : 1)) {
        throw new Error(mode === "register" ? "Mot de passe : 8 caractères minimum." : "Indiquez votre mot de passe.");
      }

      let data: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: { id: string; name: string; email: string; phone?: string | null };
      };

      if (mode === "register") {
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim() || prefill?.name?.trim() || "";
        if (fullName.length < 2) throw new Error("Indiquez votre nom.");
        const e164 = phone.trim() ? toE164Phone(phone) : undefined;
        if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) {
          throw new Error("Indiquez un numéro valide (ex. +225 07 00 11 22).");
        }
        data = await customerAuthRequest("customers/register", {
          name: fullName,
          email: normalizedEmail,
          password,
          tenantSlug,
          phone: e164,
        });
      } else {
        data = await customerAuthRequest("customers/login", {
          email: normalizedEmail,
          password,
          tenantSlug,
        });
      }

      const session: CustomerSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone ?? (mode === "register" ? toE164Phone(phone) : null),
        },
      };
      writeCustomerSession(tenantSlug, session);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] px-5 py-7 shadow-2xl sm:px-7 sm:py-8"
        style={
          darkHero
            ? { background: "var(--site-hero)", color: "var(--site-hero-fg)" }
            : { background: "var(--site-card)", color: "var(--site-fg)", border: "1px solid var(--site-border)" }
        }
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-lg leading-none"
          style={
            darkHero
              ? { background: "rgba(255,255,255,0.1)" }
              : { background: "var(--site-card)", color: "var(--site-muted)" }
          }
          aria-label="Fermer"
        >
          ×
        </button>

        <p
          className="text-xs font-medium tracking-[0.16em] uppercase"
          style={{ color: darkHero ? "var(--site-hero-muted)" : "var(--site-muted)" }}
        >
          {tenantName}
        </p>
        <h2 id={titleId} className="mt-2 pr-10 text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h2>
        <p className="mt-2 text-sm" style={{ color: darkHero ? "var(--site-hero-muted)" : "var(--site-muted)" }}>
          {mode === "login"
            ? `Connectez-vous pour finaliser votre commande chez ${tenantName}.`
            : `Créez votre compte pour valider la commande chez ${tenantName}.`}
        </p>

        <div
          className="mt-5 flex gap-1 rounded-full p-1"
          style={darkHero ? { background: "rgba(255,255,255,0.1)" } : { background: "var(--site-card)" }}
        >
          <ModeTab
            dark={darkHero}
            active={mode === "login"}
            label="Connexion"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          />
          <ModeTab
            dark={darkHero}
            active={mode === "register"}
            label="Inscription"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          />
        </div>

        <form className="mt-6 grid gap-3" onSubmit={(event) => void submit(event)}>
          {mode === "register" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field dark={darkHero} label="Prénom" value={firstName} onChange={setFirstName} autoComplete="given-name" required />
                <Field dark={darkHero} label="Nom" value={lastName} onChange={setLastName} autoComplete="family-name" required />
              </div>
              <Field dark={darkHero} label="Téléphone" value={phone} onChange={setPhone} autoComplete="tel" placeholder="+225…" />
              <Field dark={darkHero} label="Adresse" value={address} onChange={setAddress} autoComplete="street-address" />
            </>
          ) : null}
          <Field dark={darkHero} label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          <Field
            dark={darkHero}
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={mode === "register" ? "8 caractères minimum" : undefined}
            required
            minLength={mode === "register" ? 8 : 1}
          />
          {error ? <p className={`text-sm ${darkHero ? "text-red-200" : "text-red-600"}`}>{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-full px-5 py-3.5 text-sm font-medium disabled:opacity-60"
            style={
              darkHero
                ? { background: "#fff", color: "#171717" }
                : { background: "var(--site-primary)", color: "#fff" }
            }
          >
            {pending
              ? "Patientez…"
              : mode === "login"
                ? "Se connecter et commander"
                : "Créer mon compte et commander"}
          </button>
        </form>
      </div>
    </div>
  );
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function ModeTab({
  active,
  label,
  onClick,
  dark,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  dark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors"
      style={
        active
          ? { background: "#fff", color: "#171717", boxShadow: dark ? undefined : "0 1px 2px rgba(0,0,0,0.06)" }
          : { color: dark ? "var(--site-hero-muted)" : "var(--site-muted)" }
      }
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  required,
  minLength,
  placeholder,
  dark,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  dark: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs" style={{ color: dark ? "var(--site-hero-muted)" : "var(--site-muted)" }}>
          {hint}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={
          dark
            ? { border: 0, background: "#fff", color: "#171717" }
            : { border: "1px solid var(--site-border)", background: "#fff", color: "var(--site-fg)" }
        }
      />
    </label>
  );
}
