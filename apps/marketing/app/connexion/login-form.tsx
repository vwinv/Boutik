"use client";

import { useState } from "react";
import { workspaceAuthUrl } from "@boutik/domain";
import { storeResume, storeSession, type OnboardingResume } from "../onboarding/resume";

const DEMO_EMAIL = "marie@marie.local";
const DEMO_PASSWORD = "changeme";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await postLogin({ email: email.trim(), password });
      storeSession(data.accessToken, data.refreshToken);
      if (data.resume) {
        storeResume(data.resume);
        window.location.assign("/onboarding");
        return;
      }

      // Retour explicite (ex. tunnel HTTPS → /app/whatsapp) : rester sur la même origine.
      const nextParam = new URLSearchParams(window.location.search).get("next");
      if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
        const payload = encodeURIComponent(
          JSON.stringify({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }),
        );
        window.location.assign(`${nextParam}#boutik_auth=${payload}`);
        return;
      }

      const slug = resolveWorkspaceSlug(data.user);
      if (!slug) {
        window.location.assign("/app");
        return;
      }
      window.location.assign(
        workspaceAuthUrl(slug, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  function fillDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#2a2a2e] p-3 text-neutral-950 sm:p-5">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:min-h-[640px] lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between bg-neutral-950 px-8 py-8 text-white lg:flex lg:px-10 lg:py-10">
          <a href="/" className="relative z-10 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[9px] bg-white text-sm text-neutral-950">B</span>
            Boutik
          </a>

          <div className="relative z-10 max-w-md pb-4">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight xl:text-[42px]">
              Votre site professionnel, simplement.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/65">
              Boutique, restaurant ou site vitrine : créez, publiez et gérez votre activité depuis un seul espace.
            </p>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full opacity-40"
            style={{
              background:
                "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)",
            }}
          />
        </aside>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <a href="/" className="mb-8 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight lg:hidden">
            <span className="grid size-8 place-items-center rounded-[9px] bg-neutral-950 text-sm text-white">B</span>
            Boutik
          </a>

          <h2 className="text-[32px] leading-none font-semibold tracking-tight">Connexion</h2>
          <p className="mt-3 text-sm text-neutral-500">Accédez à votre espace professionnel.</p>

          <form className="mt-8 space-y-5" onSubmit={(event) => void submit(event)}>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-sm">
              <button type="button" onClick={fillDemo} className="text-neutral-500 underline-offset-2 hover:underline">
                Identifiants de démo
              </button>
              <a href="/connexion" className="text-neutral-500 underline-offset-2 hover:underline">
                Mot de passe oublié ?
              </a>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-neutral-950 py-3.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-8 text-sm text-neutral-500">
            Pas encore de compte ?{" "}
            <a href="/onboarding" className="font-semibold text-neutral-950">
              Créer un compte
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

async function postLogin(body: { email: string; password: string }) {
  let response: Response;
  try {
    response = await fetch("/api/auth/pro/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Le serveur ne répond pas.");
  }
  const raw = await response.text();
  let payload: {
    ok?: boolean;
    data?: {
      accessToken: string;
      refreshToken: string;
      resume: OnboardingResume | null;
      user?: {
        tenantId?: string | null;
        memberships?: Array<{ tenantId: string; slug: string; status?: string }>;
      };
    };
    error?: { message?: string };
  };
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {};
  } catch {
    throw new Error(
      response.status >= 500 || !raw
        ? "Le serveur est indisponible. Réessaie dans un instant."
        : "Réponse serveur invalide.",
    );
  }
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error?.message || "Une erreur est survenue.");
  }
  return payload.data;
}

function resolveWorkspaceSlug(user?: {
  tenantId?: string | null;
  memberships?: Array<{ tenantId: string; slug: string; status?: string }>;
}) {
  const memberships = (user?.memberships || []).filter((item) => item.status !== "ARCHIVED");
  if (!memberships.length) return null;
  if (user?.tenantId) {
    const current = memberships.find((item) => item.tenantId === user.tenantId);
    if (current?.slug) return current.slug;
  }
  return memberships[0]?.slug || null;
}
