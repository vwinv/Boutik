"use client";

import { formatPriceXof, type ContentItem } from "./content-data";
import { eclatHeroGradient, TEMPLATES, type TemplateDraft, type TemplateId } from "./templates";

export function SitePreview({
  template,
  items,
  businessName,
  category,
  coverUrl,
  mode,
}: {
  template: TemplateDraft;
  items: ContentItem[];
  businessName: string;
  category: "BOUTIQUE" | "RESTAURANT" | "VITRINE";
  coverUrl?: string | null;
  mode: "desktop" | "mobile";
}) {
  const current = TEMPLATES.find((item) => item.id === template.templateId) ?? TEMPLATES[0]!;
  const mark = (businessName.trim() || "e").slice(0, 1).toLowerCase();
  const products = items.slice(0, mode === "mobile" ? 4 : 8);
  const featuredLabel =
    category === "RESTAURANT" ? "Plats mis en avant" : category === "VITRINE" ? "Services mis en avant" : "Produits mis en avant";
  const sectionTitle =
    category === "RESTAURANT" ? "Notre carte" : category === "VITRINE" ? "Nos services" : "Toute la boutique";
  const discoverLabel =
    category === "RESTAURANT" ? "Voir la carte" : category === "VITRINE" ? "Découvrir" : "Découvrir la boutique";
  const cartLabel = category === "VITRINE" ? "Découvrir" : "Panier";
  const imageFirst = current.id === "atelier" || current.id === "minimal";
  const eclat = current.id === "eclat";
  const darkHero = eclat || current.id === "nocturne";
  const lightBody = eclat || current.id === "minimal" || current.id === "atelier";

  const pageBg = lightBody ? (current.id === "atelier" ? "#f4efe6" : "#ffffff") : current.previewBg;
  const pageFg = lightBody ? (current.id === "atelier" ? "#1c1917" : "#171717") : current.previewFg;
  const muted = lightBody ? "rgba(23,23,23,0.58)" : "rgba(255,255,255,0.62)";
  const heroBg = heroBackground(current.id, template.primary);
  const footerBg = template.secondary;
  const heroImage = coverUrl || "/landing/boutique-hero.jpg";

  return (
    <div
      className={`mx-auto overflow-hidden rounded-[24px] border border-black/10 shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${
        mode === "mobile" ? "w-full max-w-[360px]" : "w-full"
      }`}
      style={{ background: pageBg, color: pageFg }}
    >
      <div
        className={`flex items-center gap-3 border-b px-4 py-3 ${mode === "mobile" ? "text-[10px]" : "text-[11px]"}`}
        style={{ borderColor: lightBody ? "rgba(23,23,23,0.08)" : "rgba(255,255,255,0.1)", background: pageBg }}
      >
        <span
          className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold text-white"
          style={{ background: template.primary }}
        >
          {mark}
        </span>
        {mode === "desktop" ? (
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-3 truncate sm:flex" style={{ color: muted }}>
            <span>{featuredLabel}</span>
            <span>Catalogue</span>
            <span>À propos</span>
            <span>Contact</span>
          </nav>
        ) : (
          <span className="min-w-0 flex-1 truncate" style={{ color: muted }}>
            {businessName.trim() || "Votre site"}
          </span>
        )}
        <span
          className="ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-medium text-white"
          style={{ background: template.primary }}
        >
          {cartLabel}
          {category !== "VITRINE" ? (
            <span className="ml-1.5 inline-grid size-4 place-items-center rounded-full bg-white/20 text-[9px]">0</span>
          ) : null}
        </span>
      </div>

      <div style={{ background: heroBg, color: darkHero ? "#ffffff" : pageFg }}>
        <div
          className={`grid gap-4 p-4 ${
            mode === "desktop" ? "sm:grid-cols-[1.05fr_0.95fr] sm:items-center sm:p-6" : ""
          }`}
        >
          {imageFirst ? (
            <>
              <img
                src={heroImage}
                alt=""
                className={`w-full rounded-xl object-cover ${mode === "mobile" ? "h-40" : "h-36 sm:h-48"}`}
              />
              <HeroCopy
                discoverLabel={discoverLabel}
                eclat={eclat}
                darkHero={darkHero}
                mode={mode}
                primary={template.primary}
              />
            </>
          ) : (
            <>
              <HeroCopy
                discoverLabel={discoverLabel}
                eclat={eclat}
                darkHero={darkHero}
                mode={mode}
                primary={template.primary}
              />
              {mode === "desktop" ? (
                <img src={heroImage} alt="" className="h-36 w-full rounded-xl object-cover sm:h-48" />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className={`px-4 py-4 ${mode === "desktop" ? "sm:px-6 sm:py-6" : ""}`}>
        <p className="mb-3 text-sm font-semibold sm:text-base">{featuredLabel}</p>
        <div className={`grid gap-2.5 ${mode === "mobile" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {products.length ? (
            products.map((product, index) => (
              <article key={product.id} className="min-w-0">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-lg" style={{ background: lightBody ? "#f3f3f4" : "rgba(255,255,255,0.08)" }}>
                  {product.image ? (
                    <img src={product.image} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-[10px] opacity-50">Aperçu</span>
                  )}
                  {index === 1 ? (
                    <span
                      className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-medium text-white"
                      style={{ background: template.primary }}
                    >
                      Promo
                    </span>
                  ) : null}
                </span>
                <p className="mt-1.5 truncate text-[11px] font-medium">{product.name}</p>
                <p className="text-[11px] font-semibold" style={{ color: template.primary }}>
                  {formatPriceXof(product.priceXof)}
                </p>
              </article>
            ))
          ) : (
            <p className="col-span-full text-sm" style={{ color: muted }}>
              Aucun contenu pour l&apos;instant.
            </p>
          )}
        </div>
        {products.length > 0 && mode === "desktop" ? (
          <p className="mt-5 text-sm font-semibold sm:text-base">{sectionTitle}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-[10px] text-white" style={{ background: footerBg }}>
        <span>© 2026 {mark}</span>
        <span className="opacity-80">Propulsé par Boutik</span>
      </div>
    </div>
  );
}

function HeroCopy({
  discoverLabel,
  eclat,
  darkHero,
  mode,
  primary,
}: {
  discoverLabel: string;
  eclat: boolean;
  darkHero: boolean;
  mode: "desktop" | "mobile";
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
      <p
        className={`mt-2 leading-tight font-semibold tracking-tight ${
          mode === "mobile" ? "text-[22px]" : "text-[22px] sm:text-[28px]"
        }`}
      >
        Mode et artisanat d&apos;Afrique de l&apos;Ouest, livrés chez vous.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className="inline-flex rounded-full px-4 py-2 text-xs font-medium"
          style={darkHero ? { background: "#ffffff", color: "#171717" } : { background: primary, color: "#ffffff" }}
        >
          {discoverLabel}
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

function heroBackground(id: TemplateId, primary: string) {
  if (id === "eclat" || id === "nocturne") return eclatHeroGradient(primary);
  if (id === "atelier") {
    return "linear-gradient(135deg, #efe6d8 0%, #f4efe6 100%)";
  }
  return "linear-gradient(135deg, #ffffff 0%, #f7f7f5 100%)";
}
