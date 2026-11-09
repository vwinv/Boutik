"use client";

import { useState, type MouseEvent } from "react";
import { workspaceAuthUrl, workspaceUrl } from "@boutik/domain";
import { AUTH_KEY } from "./resume";

export type PublishResult = {
  name: string;
  slug: string;
  host: string;
  siteUrl: string;
  dashboardUrl?: string;
  dashboardHost?: string;
};

export function PublishStep({
  result,
  pending,
  error,
  onBack,
}: {
  result: PublishResult | null;
  pending: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const name = result?.name?.trim() || "votre site";
  const displayHost = result?.slug ? `${result.slug}.boutik.app` : result?.host || "votre-site.boutik.app";
  const href = result?.siteUrl || "#";
  const dashboardHref = result?.dashboardUrl || (result?.slug ? workspaceUrl(result.slug) : "/app");
  const disabled = pending || !result;

  function openDashboard(event: MouseEvent<HTMLAnchorElement>) {
    if (!result?.slug) return;
    const session = readStoredSession();
    if (!session) return;
    event.preventDefault();
    window.location.assign(workspaceAuthUrl(result.slug, session));
  }

  async function share() {
    if (!result) return;
    setShareNotice(null);
    const link = result.siteUrl || `https://${displayHost}`;
    try {
      await navigator.clipboard.writeText(link);
      setShareNotice("Lien copié dans le presse-papiers.");
    } catch {
      try {
        const input = document.createElement("input");
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        setShareNotice("Lien copié dans le presse-papiers.");
      } catch {
        setShareNotice("Impossible de copier le lien.");
      }
    }
  }

  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Publiez votre site</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
          Dernière étape avant la mise en ligne.
        </p>
      </div>

      <div className="mt-10 flex flex-1 items-start">
        <div className="w-full max-w-xl rounded-[28px] bg-[#161616] px-6 py-7 text-white sm:px-8 sm:py-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Site en ligne
          </span>
          <h3 className="mt-5 text-[28px] leading-tight font-semibold tracking-tight">
            Félicitations, {name} est publié.
          </h3>
          <a href={href} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-neutral-400 hover:text-white">
            {displayHost}
          </a>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`soft inline-flex items-center justify-center gap-2 rounded-full bg-[#0f0f0f] px-5 py-3 text-sm font-medium text-white ring-1 ring-white/15 ${
                disabled ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Voir mon site
              <span aria-hidden="true">↗</span>
            </a>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void share()}
              className="soft rounded-full bg-[#2a2a2a] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              Partager
            </button>
            <a
              href={dashboardHref}
              onClick={openDashboard}
              className={`soft inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-neutral-950 ${
                disabled ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Accéder au tableau de bord
            </a>
          </div>
          {shareNotice ? <p className="mt-3 text-sm text-neutral-400">{shareNotice}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
      </div>
    </>
  );
}

function readStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY) || window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}
