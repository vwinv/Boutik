"use client";

import { useEffect, useState } from "react";
import {
  eclatHeroGradient,
  PREVIEW_PRODUCTS,
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  TEMPLATES,
  templateName,
  type TemplateDraft,
  type TemplateId,
} from "./templates";

export function TemplateStep({
  draft,
  businessName,
  coverUrl,
  pending,
  error,
  onChange,
  onApply,
  onBack,
  onContinue,
}: {
  draft: TemplateDraft;
  businessName: string;
  coverUrl?: string | null;
  pending: boolean;
  error: string | null;
  onChange: (next: Partial<TemplateDraft>) => void;
  onApply: (templateId: TemplateId) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [pendingId, setPendingId] = useState<TemplateId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const current = TEMPLATES.find((item) => item.id === draft.templateId) ?? TEMPLATES[0]!;
  const mark = (businessName.trim() || "e").slice(0, 1).toLowerCase();
  const eclat = current.id === "eclat";
  const imageFirst = current.id === "atelier" || current.id === "minimal";
  const darkHero = eclat || current.id === "nocturne";
  const lightBody = eclat || current.id === "minimal" || current.id === "atelier";
  const pageBg = lightBody ? (current.id === "atelier" ? "#f4efe6" : "#ffffff") : current.previewBg;
  const pageFg = lightBody ? (current.id === "atelier" ? "#1c1917" : "#171717") : current.previewFg;
  const heroBg = templateHeroBackground(current.id, draft.primary);
  const footerBg = draft.secondary;
  const heroImage = coverUrl || "/landing/boutique-hero.jpg";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function selectTemplate(id: TemplateId) {
    if (id === draft.templateId && draft.applied) return;
    if (draft.applied && id !== draft.templateId) {
      setPendingId(id);
      return;
    }
    onApply(id);
    setToast(`Modèle « ${templateName(id)} » appliqué`);
  }

  function confirmChange() {
    if (!pendingId) return;
    onApply(pendingId);
    setToast(`Modèle « ${templateName(pendingId)} » appliqué`);
    setPendingId(null);
  }

  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Choisissez un modèle et vos couleurs</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
          L&apos;aperçu se met à jour en direct. Tout reste modifiable après publication.
        </p>
      </div>

      <div className="mt-8 grid flex-1 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEMPLATES.map((item) => {
              const selected = draft.templateId === item.id && draft.applied;
              const light = item.id === "eclat" || item.id === "minimal" || item.id === "atelier";
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectTemplate(item.id)}
                  className={`soft overflow-hidden rounded-2xl border-2 text-left transition-colors ${
                    selected ? "border-neutral-950" : "border-neutral-200"
                  }`}
                >
                  <span
                    className="block h-16 w-full sm:h-20"
                    style={{
                      background: item.id === "eclat" ? eclatHeroGradient("#6b4c9a") : item.swatch,
                      borderBottom: light ? "1px solid #e5e5e5" : undefined,
                    }}
                  />
                  <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-[11px] text-neutral-500">{item.badge}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7">
            <p className="text-sm font-medium text-neutral-800">Couleur principale</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {PRIMARY_COLORS.map((color) => (
                <Swatch
                  key={`primary-${color}`}
                  color={color}
                  selected={draft.primary === color}
                  onSelect={() => onChange({ primary: color })}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-neutral-800">Couleur secondaire</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {SECONDARY_COLORS.map((color) => (
                <Swatch
                  key={`secondary-${color}`}
                  color={color}
                  selected={draft.secondary === color}
                  onSelect={() => onChange({ secondary: color })}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-neutral-200 shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
          style={{ background: pageBg, color: pageFg }}
        >
          <div
            className="flex items-center gap-3 border-b px-4 py-3 text-[11px]"
            style={{ borderColor: lightBody ? "rgba(23,23,23,0.08)" : "rgba(255,255,255,0.1)" }}
          >
            <span
              className="grid size-6 place-items-center rounded-md text-[11px] font-semibold text-white"
              style={{ background: draft.primary }}
            >
              {mark}
            </span>
            <nav
              className="hidden min-w-0 flex-1 items-center gap-3 truncate sm:flex"
              style={{ color: lightBody ? "rgba(23,23,23,0.58)" : "rgba(255,255,255,0.62)" }}
            >
              <span>Accueil</span>
              <span>Produits mis en avant</span>
              <span>Catégories</span>
              <span>À propos</span>
            </nav>
            <span
              className="ml-auto rounded-full px-3 py-1 text-[11px] font-medium text-white"
              style={{ background: draft.primary }}
            >
              Commander
            </span>
          </div>

          <div style={{ background: heroBg, color: darkHero ? "#ffffff" : pageFg }}>
            <div className="grid gap-4 p-4 sm:grid-cols-[1.05fr_0.95fr] sm:items-center">
              {imageFirst ? (
                <>
                  <img src={heroImage} alt="" className="h-36 w-full rounded-xl object-cover sm:h-44" />
                  <TemplateHeroCopy eclat={eclat} darkHero={darkHero} primary={draft.primary} />
                </>
              ) : (
                <>
                  <TemplateHeroCopy eclat={eclat} darkHero={darkHero} primary={draft.primary} />
                  <img src={heroImage} alt="" className="h-36 w-full rounded-xl object-cover sm:h-44" />
                </>
              )}
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="mb-3 text-sm font-semibold">Nos produits</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PREVIEW_PRODUCTS.map((product) => (
                <article key={product.name} className="min-w-0">
                  <img src={product.image} alt="" className="aspect-[4/5] w-full rounded-lg object-cover" />
                  <p className="mt-1.5 truncate text-[11px] font-medium">{product.name}</p>
                  <p className="text-[11px] opacity-70">{product.price}</p>
                </article>
              ))}
            </div>
          </div>

          <div
            className="flex items-center justify-between px-4 py-3 text-[10px] text-white"
            style={{ background: footerBg }}
          >
            <span>© 2026 {mark}</span>
            <span className="opacity-80">Propulsé par Boutik</span>
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          Continuer
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {pendingId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/45 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-change-title"
            className="w-full max-w-md rounded-3xl bg-white px-6 py-6 shadow-xl"
          >
            <h3 id="template-change-title" className="text-lg font-semibold tracking-tight">
              Changer de modèle ?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Votre site passera au modèle « {templateName(pendingId)} ». Vos contenus sont conservés.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingId(null)}
                className="soft rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmChange}
                className="soft rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
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

function TemplateHeroCopy({
  eclat,
  darkHero,
  primary,
}: {
  eclat: boolean;
  darkHero: boolean;
  primary: string;
}) {
  return (
    <div>
      <p
        className="text-[10px] font-medium tracking-[0.16em] uppercase"
        style={{ color: darkHero ? "rgba(255,255,255,0.72)" : "rgba(23,23,23,0.58)" }}
      >
        BOUTIQUE · ABIDJAN
      </p>
      <p className="mt-2 text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]">
        Mode et artisanat d&apos;Afrique de l&apos;Ouest, livrés chez vous.
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

function templateHeroBackground(id: TemplateId, primary: string) {
  if (id === "eclat" || id === "nocturne") return eclatHeroGradient(primary);
  if (id === "atelier") {
    return "linear-gradient(135deg, #efe6d8 0%, #f4efe6 100%)";
  }
  return "linear-gradient(135deg, #ffffff 0%, #f7f7f5 100%)";
}

function Swatch({
  color,
  selected,
  onSelect,
}: {
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Couleur ${color}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`size-8 rounded-full border-2 transition-transform ${
        selected ? "scale-105 border-white ring-2 ring-neutral-950" : "border-transparent"
      }`}
      style={{ background: color }}
    />
  );
}
