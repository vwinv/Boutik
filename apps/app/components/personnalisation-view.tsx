"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { proApi, proUpload } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import {
  LAYOUTS,
  PRIMARY_COLORS,
  PREVIEW_PRODUCTS,
  SECONDARY_COLORS,
  layoutHeroBackground,
  layoutName,
  resolveLayoutKey,
  type LayoutKey,
} from "../lib/templates";
import { AuthImage } from "./auth-image";
import { ProShell } from "./pro-shell";

type SiteData = {
  id: string;
  tenantId: string;
  slug: string;
  host: string;
  url: string;
  status: string;
  general: { title: string; tagline: string | null; about: string | null };
  theme: {
    layoutKey: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    backgroundColor: string | null;
    textColor: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
  };
};

type Viewport = "desktop" | "mobile";

export function PersonnalisationPage() {
  return (
    <ProShell title="Personnalisation">
      <PersonnalisationBody />
    </ProShell>
  );
}

function PersonnalisationBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [title, setTitle] = useState("");
  const [primary, setPrimary] = useState("#c4457a");
  const [secondary, setSecondary] = useState("#2d4a3e");
  const [layoutKey, setLayoutKey] = useState<LayoutKey>("eclat");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [pendingLayout, setPendingLayout] = useState<LayoutKey | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const titleTimer = useRef<number | null>(null);

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
      let data: SiteData;
      try {
        data = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`);
      } catch {
        data = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
      applySite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la personnalisation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function applySite(data: SiteData) {
    setSite(data);
    setTitle(data.general.title || data.slug);
    setPrimary(normalizeHex(data.theme.primaryColor) || "#c4457a");
    setSecondary(normalizeHex(data.theme.secondaryColor) || "#2d4a3e");
    setLayoutKey(resolveLayoutKey(data.theme.layoutKey));
    setLogoUrl(data.theme.logoUrl);
    setCoverUrl(data.theme.coverUrl);
  }

  async function patchTheme(partial: {
    layoutKey?: LayoutKey;
    primaryColor?: string;
    secondaryColor?: string;
  }) {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await proApi<SiteData>(`/api/workspaces/${tenantId}/site/theme`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      });
      applySite(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle(next: string) {
    if (!tenantId) return;
    const trimmed = next.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await proApi<SiteData>(`/api/workspaces/${tenantId}/site`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      applySite(updated);
      setToast("Nom du site enregistré");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer le nom.");
    } finally {
      setSaving(false);
    }
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (titleTimer.current) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      void saveTitle(value);
    }, 700);
  }

  async function selectPrimary(color: string) {
    setPrimary(color);
    await patchTheme({ primaryColor: color });
    setToast("Couleur principale mise à jour");
  }

  async function selectSecondary(color: string) {
    setSecondary(color);
    await patchTheme({ secondaryColor: color });
    setToast("Couleur secondaire mise à jour");
  }

  function requestLayout(id: LayoutKey) {
    if (id === layoutKey) return;
    setPendingLayout(id);
  }

  async function confirmLayout() {
    if (!pendingLayout) return;
    const id = pendingLayout;
    setPendingLayout(null);
    setLayoutKey(id);
    await patchTheme({ layoutKey: id });
    setToast(`Modèle « ${layoutName(id)} » appliqué`);
  }

  async function uploadVisual(kind: "logo" | "cover", file: File) {
    if (!tenantId) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Le fichier doit faire moins de 4 Mo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const updated = await proUpload<SiteData>(`/api/workspaces/${tenantId}/site/visuals`, form);
      applySite(updated);
      setToast(kind === "logo" ? "Logo importé" : "Photo de couverture importée");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import du visuel impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        <div className="h-[640px] animate-pulse rounded-[24px] bg-white" />
        <div className="h-[640px] animate-pulse rounded-[24px] bg-white" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white px-5 py-8 text-sm text-red-600">
        {error || "Personnalisation indisponible."}
      </div>
    );
  }

  const mark = (title.trim() || site.slug || "b").slice(0, 1).toLowerCase();
  const layout = LAYOUTS.find((item) => item.id === layoutKey) ?? LAYOUTS[0]!;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <section className="rounded-[24px] bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Identité</h2>
            <label className="mt-4 block">
              <span className="text-sm text-neutral-500">Nom du site</span>
              <input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
                maxLength={80}
              />
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Logo</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-neutral-200 bg-white p-1.5 text-lg font-semibold text-neutral-700">
                    <AuthImage
                      src={logoUrl ?? undefined}
                      className="max-h-full max-w-full object-contain"
                      fallback={mark}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={saving}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      Importer
                    </button>
                    <p className="mt-1.5 text-xs text-neutral-500">PNG, JPG · 4 Mo</p>
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadVisual("logo", file);
                        event.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-neutral-500">Couverture</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                    <AuthImage
                      src={coverUrl ?? undefined}
                      className="absolute inset-0 size-full object-cover"
                      fallback={<div className="grid size-full place-items-center text-[10px] text-neutral-500">—</div>}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={saving}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      Importer
                    </button>
                    <p className="mt-1.5 text-xs text-neutral-500">PNG, JPG · 4 Mo</p>
                    <input
                      ref={coverFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadVisual("cover", file);
                        event.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Couleurs</h2>
            <div className="mt-4">
              <p className="text-sm text-neutral-500">Couleur principale</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {PRIMARY_COLORS.map((color) => (
                  <Swatch
                    key={`p-${color}`}
                    color={color}
                    selected={primary.toLowerCase() === color.toLowerCase()}
                    onSelect={() => void selectPrimary(color)}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm text-neutral-500">Couleur secondaire</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {SECONDARY_COLORS.map((color) => (
                  <Swatch
                    key={`s-${color}`}
                    color={color}
                    selected={secondary.toLowerCase() === color.toLowerCase()}
                    onSelect={() => void selectSecondary(color)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Modèles</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LAYOUTS.map((item) => {
                const active = item.id === layoutKey;
                return (
                  <article
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border-2 ${
                      active ? "border-neutral-950" : "border-neutral-200"
                    }`}
                  >
                    <div
                      className="h-20"
                      style={{
                        background:
                          item.id === "eclat" || item.id === "nocturne"
                            ? layoutHeroBackground(item.id, item.id === "eclat" ? "#6b4c9a" : "#6b4c9a")
                            : item.swatch,
                      }}
                    />
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{item.name}</p>
                        <span className="text-[11px] text-neutral-500">{item.badge}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.blurb}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setViewport("desktop")}
                          className="flex-1 rounded-xl border border-neutral-200 px-2 py-2 text-xs font-medium"
                        >
                          Prévisualiser
                        </button>
                        <button
                          type="button"
                          disabled={active || saving}
                          onClick={() => requestLayout(item.id)}
                          className="flex-1 rounded-xl bg-neutral-950 px-2 py-2 text-xs font-semibold text-white disabled:bg-neutral-300"
                        >
                          {active ? "En cours" : "Utiliser"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {error ? <p className="px-1 text-sm text-red-600">{error}</p> : null}
          {saving ? <p className="px-1 text-xs text-neutral-500">Enregistrement…</p> : null}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[24px] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">Aperçu en direct</h2>
              <div className="inline-flex rounded-full bg-neutral-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewport("desktop")}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    viewport === "desktop" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
                  }`}
                >
                  Ordinateur
                </button>
                <button
                  type="button"
                  onClick={() => setViewport("mobile")}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    viewport === "mobile" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
                  }`}
                >
                  Mobile
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-neutral-50">
              <div
                className={`mx-auto overflow-hidden transition-[max-width] duration-300 ${
                  viewport === "mobile" ? "max-w-[360px]" : "max-w-none"
                }`}
              >
                <LivePreview
                  title={title || site.slug}
                  mark={mark}
                  logoUrl={logoUrl}
                  layoutKey={layoutKey}
                  primary={primary}
                  secondary={secondary}
                  coverUrl={coverUrl}
                  pageBg={layout.id === "atelier" ? "#f4efe6" : layout.previewBg}
                  pageFg={layout.previewFg}
                  compact={viewport === "mobile"}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>

      {pendingLayout ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold tracking-tight">Changer de modèle ?</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Votre site passera au modèle « {layoutName(pendingLayout)} ». Vos contenus sont conservés.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingLayout(null)}
                className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmLayout()}
                className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white"
              >
                Changer de modèle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm shadow-lg ring-1 ring-black/5">
          <span className="size-2 rounded-full bg-emerald-500" />
          {toast}
        </div>
      ) : null}
    </>
  );
}

function LivePreview({
  title,
  mark,
  logoUrl,
  layoutKey,
  primary,
  secondary,
  coverUrl,
  pageBg,
  pageFg,
  compact,
}: {
  title: string;
  mark: string;
  logoUrl: string | null;
  layoutKey: LayoutKey;
  primary: string;
  secondary: string;
  coverUrl: string | null;
  pageBg: string;
  pageFg: string;
  compact: boolean;
}) {
  const darkHero = layoutKey === "eclat" || layoutKey === "nocturne";
  const lightBody = layoutKey === "eclat" || layoutKey === "minimal" || layoutKey === "atelier";
  const imageFirst = layoutKey === "atelier" || layoutKey === "minimal";
  const heroBg = layoutHeroBackground(layoutKey, primary);
  const coverFallback = (
    <div className={`grid w-full place-items-center rounded-xl bg-neutral-200/80 text-xs text-neutral-500 ${compact ? "h-36" : "h-44"}`}>
      Couverture
    </div>
  );

  return (
    <div style={{ background: pageBg, color: pageFg }}>
      <div
        className="flex items-center gap-3 border-b px-4 py-3 text-[11px]"
        style={{ borderColor: lightBody ? "rgba(23,23,23,0.08)" : "rgba(255,255,255,0.1)" }}
      >
        <span
          className="grid size-7 place-items-center overflow-hidden rounded-md text-[11px] font-semibold text-white"
          style={{ background: primary }}
        >
          <AuthImage src={logoUrl ?? undefined} className="size-full object-cover" fallback={mark} />
        </span>
        {!compact ? (
          <nav
            className="min-w-0 flex-1 items-center gap-3 truncate sm:flex"
            style={{ color: lightBody ? "rgba(23,23,23,0.58)" : "rgba(255,255,255,0.62)" }}
          >
            <span>Accueil</span>
            <span>Produits</span>
            <span>À propos</span>
          </nav>
        ) : (
          <span className="flex-1 truncate text-xs font-medium">{title}</span>
        )}
        <span className="ml-auto rounded-full px-3 py-1 text-[11px] font-medium text-white" style={{ background: primary }}>
          Commander
        </span>
      </div>

      <div style={{ background: heroBg, color: darkHero ? "#ffffff" : pageFg }}>
        <div className={`grid gap-4 p-4 ${compact ? "" : "sm:grid-cols-[1.05fr_0.95fr] sm:items-center"}`}>
          {imageFirst ? (
            <>
              <AuthImage
                src={coverUrl ?? undefined}
                className={`w-full rounded-xl object-cover ${compact ? "h-36" : "h-44"}`}
                fallback={coverFallback}
              />
              <HeroCopy darkHero={darkHero} primary={primary} />
            </>
          ) : (
            <>
              <HeroCopy darkHero={darkHero} primary={primary} />
              <AuthImage
                src={coverUrl ?? undefined}
                className={`w-full rounded-xl object-cover ${compact ? "h-36" : "h-44"}`}
                fallback={coverFallback}
              />
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="mb-3 text-sm font-semibold">Nos produits</p>
        <div className={`grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {PREVIEW_PRODUCTS.map((product) => (
            <article key={product.name} className="min-w-0">
              <div className="aspect-[4/5] w-full rounded-lg bg-neutral-200/80" />
              <p className="mt-1.5 truncate text-[11px] font-medium">{product.name}</p>
              <p className="text-[11px] opacity-70">{product.price}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-[10px] text-white" style={{ background: secondary }}>
        <span>© {new Date().getFullYear()} {title}</span>
        <span className="opacity-80">Propulsé par Boutik</span>
      </div>
    </div>
  );
}

function HeroCopy({ darkHero, primary }: { darkHero: boolean; primary: string }) {
  return (
    <div>
      <p
        className="text-[10px] font-medium tracking-[0.16em] uppercase"
        style={{ color: darkHero ? "rgba(255,255,255,0.72)" : "rgba(23,23,23,0.58)" }}
      >
        Boutique
      </p>
      <p className="mt-2 text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]">
        Mode et artisanat d’Afrique de l’Ouest, livrés chez vous.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className="inline-flex rounded-full px-4 py-2 text-xs font-medium"
          style={darkHero ? { background: "#ffffff", color: "#171717" } : { background: primary, color: "#ffffff" }}
        >
          Découvrir
        </span>
        <span
          className="inline-flex rounded-full border px-4 py-2 text-xs font-medium"
          style={{
            borderColor: darkHero ? "rgba(255,255,255,0.35)" : "rgba(23,23,23,0.15)",
            color: darkHero ? "#ffffff" : "inherit",
          }}
        >
          Nous contacter
        </span>
      </div>
    </div>
  );
}

function Swatch({ color, selected, onSelect }: { color: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`size-9 rounded-full border-2 transition-transform ${
        selected ? "scale-105 border-neutral-950" : "border-transparent"
      }`}
      style={{ background: color }}
      title={color}
    />
  );
}

function normalizeHex(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}
