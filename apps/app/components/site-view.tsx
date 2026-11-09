"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type SiteData = {
  id: string;
  tenantId: string;
  slug: string;
  host: string;
  url: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED" | "ARCHIVED";
  siteStatus: string;
  category: string;
  template: { id: string; slug: string; name: string } | null;
  general: { title: string; tagline: string | null; about: string | null };
  theme: {
    layoutKey: string | null;
    primaryColor: string | null;
    backgroundColor: string | null;
    textColor: string | null;
    coverUrl: string | null;
  };
  publishedAt: string | null;
  unpublishedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  updatedAt?: string | null;
};

type ConfirmKind = "publish" | "maintenance" | null;
type Viewport = "desktop" | "mobile";

export function SitePage() {
  return (
    <ProShell title="Mon site">
      <SiteBody />
    </ProShell>
  );
}

function SiteBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe(session.accessToken);
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      setTenantId(active.tenantId);
      try {
        const data = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`);
        setSite(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/introuvable|not found|SITE_NOT_FOUND/i.test(message)) {
          const created = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          setSite(created);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le site.");
      setSite(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(kind: ConfirmKind) {
    if (!tenantId || !kind) return;
    setBusy(true);
    setActionError(null);
    try {
      const path =
        kind === "publish"
          ? `/api/workspaces/${tenantId}/site/publish`
          : `/api/workspaces/${tenantId}/site/suspend`;
      const body = kind === "maintenance" ? JSON.stringify({ reason: "Maintenance demandée par le professionnel" }) : undefined;
      const updated = await proApi<SiteData>(path, {
        method: "POST",
        body,
      });
      setSite(updated);
      setConfirm(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function shareSite() {
    if (!site) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: site.general.title || "Mon site Boutik", url: site.url });
        return;
      }
      await navigator.clipboard.writeText(site.url);
      setShareHint("Lien copié");
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      setShareHint("Impossible de partager");
      window.setTimeout(() => setShareHint(null), 2000);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
        <div className="h-[560px] animate-pulse rounded-[24px] bg-white" />
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-[24px] bg-white" />
          <div className="h-56 animate-pulse rounded-[24px] bg-white" />
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white px-5 py-8 text-sm text-red-600">
        {error || "Site indisponible."}
      </div>
    );
  }

  const statusMeta = statusLabel(site.status);
  const modelName = site.template?.name || layoutLabel(site.theme.layoutKey);
  const isPublished = site.status === "PUBLISHED";
  const isSuspended = site.status === "SUSPENDED";

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
        <article className="overflow-hidden rounded-[24px] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">Aperçu du site</h2>
            <div className="inline-flex rounded-full bg-neutral-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setViewport("desktop")}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                  viewport === "desktop" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
                }`}
              >
                Ordinateur
              </button>
              <button
                type="button"
                onClick={() => setViewport("mobile")}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                  viewport === "mobile" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          <div className="bg-neutral-100/80 px-4 py-5 sm:px-6 sm:py-6">
            <div
              className={`mx-auto overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)] transition-[max-width] duration-300 ${
                viewport === "mobile" ? "max-w-[390px]" : "max-w-none"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-2 truncate text-xs text-neutral-400">{site.host}</span>
              </div>
              <div className={`relative bg-neutral-950 ${viewport === "mobile" ? "h-[640px]" : "h-[560px]"}`}>
                {isPublished ? (
                  <iframe
                    key={`live-${site.status}-${site.updatedAt ?? site.publishedAt ?? "now"}`}
                    title="Aperçu du site"
                    src={`${site.url}${site.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(site.updatedAt ?? site.publishedAt ?? "1")}`}
                    className="h-full w-full border-0 bg-white"
                  />
                ) : isSuspended ? (
                  <MaintenancePreview title={site.general.title || site.slug} />
                ) : (
                  <DraftPreview site={site} />
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-neutral-500">
              {isPublished
                ? "Aperçu du site public tel que vos visiteurs le voient."
                : isSuspended
                  ? "État actuel : maintenance — vos visiteurs voient cette page."
                  : "État actuel : brouillon — le site n’est pas encore visible au public."}
            </p>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="rounded-[24px] bg-white p-5">
            <h2 className="text-base font-semibold tracking-tight">Statut</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">État</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-neutral-500">Adresse publique</span>
                <a href={site.url} target="_blank" rel="noreferrer" className="text-right font-medium hover:underline">
                  {site.host}
                </a>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-neutral-500">Dernière publication</span>
                <span className="text-right font-medium">{formatPublishedAt(site.publishedAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-neutral-500">Modèle</span>
                <span className="text-right font-medium">{modelName}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-5">
            <h2 className="text-base font-semibold tracking-tight">Actions</h2>
            {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
            <div className="mt-4 space-y-2.5">
              {isSuspended ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirm("publish");
                  }}
                  className="flex w-full items-center justify-center rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  Republier le site
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPublished}
                  onClick={() => {
                    setActionError(null);
                    setConfirm("publish");
                  }}
                  className="flex w-full items-center justify-center rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-default disabled:bg-neutral-300"
                >
                  {isPublished ? "Site déjà publié" : "Publier le site"}
                </button>
              )}

              <Link
                href="/personnalisation"
                className="flex w-full items-center justify-center rounded-2xl bg-neutral-800 px-4 py-3 text-sm font-semibold text-white"
              >
                Modifier l’apparence
              </Link>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-medium"
                >
                  Prévisualiser
                </a>
                <button
                  type="button"
                  onClick={() => void shareSite()}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-medium"
                >
                  {shareHint || "Partager"}
                </button>
              </div>

              {!isSuspended ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setConfirm("maintenance");
                  }}
                  className="w-full pt-1 text-center text-sm font-medium text-neutral-500 underline-offset-2 hover:text-neutral-950 hover:underline"
                >
                  Mettre en maintenance
                </button>
              ) : (
                <p className="pt-1 text-center text-xs text-neutral-500">
                  Site en maintenance{site.suspendedReason ? ` — ${site.suspendedReason}` : ""}.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {confirm ? (
        <ConfirmModal
          kind={confirm}
          host={site.host}
          busy={busy}
          error={actionError}
          onCancel={() => {
            if (!busy) {
              setConfirm(null);
              setActionError(null);
            }
          }}
          onConfirm={() => void runAction(confirm)}
        />
      ) : null}
    </>
  );
}

function MaintenancePreview({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center bg-black px-6 text-white">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">Site en maintenance</p>
        <p className="mt-3 text-sm text-white/50">{title}</p>
      </div>
    </div>
  );
}

function DraftPreview({ site }: { site: SiteData }) {
  const bg = site.theme.backgroundColor || "#0a0a0a";
  const text = site.theme.textColor || "#fafafa";
  const accent = site.theme.primaryColor || "#fafafa";
  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: bg, color: text }}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-xs">
        <span className="font-semibold tracking-tight">{site.general.title || site.slug}</span>
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-200">Brouillon</span>
      </header>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        {site.theme.coverUrl ? (
          <img src={site.theme.coverUrl} alt="" className="mb-6 max-h-40 w-full rounded-2xl object-cover opacity-90" />
        ) : null}
        <p className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {site.general.tagline || "Votre vitrine Boutik, bientôt en ligne."}
        </p>
        <p className="mt-3 max-w-md text-sm opacity-70">
          {site.general.about || "Publiez le site pour le rendre visible à vos clients."}
        </p>
        <p className="mt-6 text-xs opacity-50" style={{ color: accent }}>
          Aperçu brouillon — non visible par les visiteurs.
        </p>
      </div>
    </div>
  );
}

function ConfirmModal({
  kind,
  host,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  kind: Exclude<ConfirmKind, null>;
  host: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isPublish = kind === "publish";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">
          {isPublish ? "Publier le site ?" : "Mettre le site en maintenance ?"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {isPublish
            ? `Votre site sera visible par tous à l’adresse ${host}.`
            : "Les visiteurs verront une page « Revenez bientôt » le temps de vos modifications."}
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
              isPublish ? "bg-neutral-950" : "bg-red-600"
            }`}
          >
            {busy ? "…" : isPublish ? "Publier" : "Mettre en maintenance"}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: SiteData["status"]) {
  if (status === "PUBLISHED") {
    return { label: "Publié", className: "bg-emerald-100 text-emerald-700" };
  }
  if (status === "SUSPENDED") {
    return { label: "Maintenance", className: "bg-red-100 text-red-700" };
  }
  if (status === "ARCHIVED") {
    return { label: "Archivé", className: "bg-neutral-200 text-neutral-600" };
  }
  return { label: "Brouillon", className: "bg-[#ffedd5] text-[#c2410c]" };
}

function layoutLabel(layoutKey: string | null) {
  if (!layoutKey) return "—";
  const key = layoutKey.toLowerCase();
  if (key.includes("nocturne")) return "Nocturne";
  if (key.includes("minimal")) return "Minimal";
  if (key.includes("atelier")) return "Atelier";
  if (key.includes("eclat") || key.includes("éclat")) return "Éclat";
  return layoutKey;
}

function formatPublishedAt(value: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", " -");
}
