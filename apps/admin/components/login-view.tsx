"use client";

import { useState, type FormEvent } from "react";
import { staffLogin } from "../lib/auth";

const DEMO_EMAIL = "admin@boutik.local";
const DEMO_PASSWORD = "changeme";

export function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await staffLogin(email.trim(), password);
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a1a1a] p-4 text-neutral-950 sm:p-6">
      <section className="w-full max-w-[440px] rounded-[28px] bg-white px-7 py-9 shadow-2xl sm:px-9 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[9px] bg-neutral-950 text-sm text-white">B</span>
            BoutiK
          </a>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
            Admin
          </span>
        </div>

        <h1 className="mt-9 text-[32px] leading-none font-semibold tracking-tight">Connexion équipe</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          Accès réservé aux membres de l’équipe BoutiK. Chaque connexion est journalisée.
        </p>

        <form className="mt-8 space-y-5" onSubmit={(event) => void submit(event)}>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Email professionnel</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom@boutik.app"
              className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none placeholder:text-neutral-300 focus:border-neutral-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-neutral-950 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Continuer"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
              setError(null);
            }}
            className="text-neutral-600 underline-offset-2 hover:underline"
          >
            Remplir avec le compte démo
          </button>
          <span className="text-neutral-400">Mot de passe oublié ?</span>
        </div>
      </section>
    </main>
  );
}
