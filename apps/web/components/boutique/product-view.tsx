"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StorefrontProduct, StorefrontVariant, TenantPublic } from "@boutik/sdk";
import { formatPriceXof, isLightLayout, productImage, resolveLayout } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { useCart } from "./cart-context";
import { ProductReviews } from "./product-reviews";
import { StoreShell } from "./store-shell";

export function ProductPage({
  tenant,
  product,
  related,
  basePath,
}: {
  tenant: TenantPublic;
  product: StorefrontProduct;
  related: StorefrontProduct[];
  basePath: string;
}) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <ProductView tenant={tenant} product={product} related={related} basePath={basePath} />
    </StoreShell>
  );
}

function ProductView({
  tenant,
  product,
  related,
  basePath,
}: {
  tenant: TenantPublic;
  product: StorefrontProduct;
  related: StorefrontProduct[];
  basePath: string;
}) {
  const site = tenant.site;
  const layout = resolveLayout(site?.theme?.layoutKey);
  const light = isLightLayout(layout);
  const homeHref = storeHref(basePath, "/");
  const cartHref = storeHref(basePath, "/panier");
  const cart = useCart();

  const variants = product.variants ?? [];
  const optionModel = useMemo(() => buildOptionModel(variants), [variants]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>(() => initialSelections(optionModel));
  const [quantity, setQuantity] = useState(1);

  const visualKind =
    optionModel.axes.find((axis) => {
      const kind = axis.kind.trim().toLowerCase();
      return kind === "couleur" || kind === "motif" || kind === "imprimé" || kind === "imprime";
    })?.kind ?? optionModel.axes[0]?.kind ?? null;
  const visualValue = visualKind ? selections[visualKind] ?? null : null;

  const gallery = useMemo(() => {
    const photos = [...(product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!photos.length) return [productImage(product.name, product.photos)];
    const forOption = visualValue
      ? photos.filter((photo) => photo.optionValue === visualValue)
      : [];
    const general = photos.filter((photo) => !photo.optionKind && !photo.optionValue);
    const chosen = forOption.length ? forOption : general.length ? general : photos;
    return chosen.map((photo) => photo.url);
  }, [product, visualValue]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [visualValue]);

  const optionThumbs = useMemo(() => {
    const map = new Map<string, string>();
    for (const photo of product.photos ?? []) {
      if (!photo.optionValue || !photo.url) continue;
      if (!map.has(photo.optionValue)) map.set(photo.optionValue, photo.url);
    }
    return map;
  }, [product.photos]);

  const selected = useMemo(() => {
    if (!variants.length) return null;
    return (
      variants.find((variant) => variantMatchesSelections(variant, selections, optionModel.mode)) ??
      (optionModel.mode === "flat" ? variants[0] ?? null : null)
    );
  }, [variants, optionModel.mode, selections]);

  const priceXof = selected?.priceXof ?? product.priceXof;
  const availability = selected?.availability ?? product.availability;
  const inStock = availability !== "OUT_OF_STOCK" && selected?.stockQty !== 0;
  const image = gallery[Math.min(photoIndex, gallery.length - 1)] ?? gallery[0]!;
  const showThumbnails = gallery.length > 1;
  const refLabel = selected?.sku || `REF-${String(product.sortOrder + 101).padStart(3, "0")}`;
  const categoryLabel = product.category?.name || "Produits";
  const city = site?.contact.city || tenant.contact?.city || "Abidjan";
  const description =
    product.description?.trim() || "Pièce artisanale, fabriquée à la main en petite série.";

  function selectAxisValue(kind: string, value: string) {
    setSelections((current) => {
      const next = { ...current, [kind]: value };
      if (optionModel.mode !== "axes") return next;
      if (variants.some((variant) => variantMatchesSelections(variant, next, "axes") && isVariantSellable(variant))) {
        return next;
      }
      const fallback = variants.find(
        (variant) =>
          variantOptions(variant).some((option) => option.kind === kind && option.value === value) &&
          isVariantSellable(variant),
      );
      if (!fallback) return next;
      const repaired = { ...next };
      for (const option of variantOptions(fallback)) {
        repaired[option.kind] = option.value;
      }
      return repaired;
    });
  }

  function addToCart(goToCart = false) {
    if (!inStock) return;
    const name = selected ? `${product.name} · ${selected.name}` : product.name;
    cart.addItem(
      {
        slug: selected ? `${product.slug}:${selected.id}` : product.slug,
        name,
        priceXof,
        image,
        variantId: selected?.id ?? null,
        variantName: selected?.name ?? null,
      },
      quantity,
    );
    if (goToCart) window.location.href = cartHref;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`${homeHref}#boutique`}
        className="inline-flex items-center gap-1 text-sm font-medium"
        style={{ color: "var(--site-muted)" }}
      >
        ← Retour à la boutique
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div>
          <div
            className="overflow-hidden rounded-[28px]"
            style={{ background: light ? "var(--site-card)" : "rgba(255,255,255,0.06)" }}
          >
            <img src={image} alt={product.name} className="aspect-[4/5] w-full object-cover" />
          </div>
          {showThumbnails ? (
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((src, index) => {
                const active = index === photoIndex;
                return (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    aria-label={`Photo ${index + 1}`}
                    aria-pressed={active}
                    onClick={() => setPhotoIndex(index)}
                    className="overflow-hidden rounded-2xl border-2 transition-colors"
                    style={{
                      borderColor: active ? "var(--site-primary)" : "transparent",
                      background: light ? "var(--site-card)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <img src={src} alt="" className="aspect-square w-full object-cover" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm" style={{ color: "var(--site-muted)" }}>
            {categoryLabel} · {refLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold" style={{ color: "var(--site-primary)" }}>
            {formatPriceXof(priceXof)}
          </p>
          {product.compareAtPriceXof && product.compareAtPriceXof > priceXof ? (
            <p className="mt-1 text-sm line-through" style={{ color: "var(--site-muted)" }}>
              {formatPriceXof(product.compareAtPriceXof)}
            </p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
            {description}
          </p>

          {variants.length > 0 ? (
            <div className="mt-8 space-y-5">
              {optionModel.axes.map((axis) => (
                <OptionRow
                  key={axis.kind}
                  label={axis.kind || "Option"}
                  kind={axis.kind}
                  values={axis.values}
                  selected={selections[axis.kind] ?? null}
                  light={light}
                  thumbs={optionThumbs}
                  isUnavailable={(value) => {
                    if (optionModel.mode === "flat") {
                      return variants.find((variant) => variant.name === value)?.availability === "OUT_OF_STOCK";
                    }
                    const trial = { ...selections, [axis.kind]: value };
                    return !variants.some(
                      (variant) => variantMatchesSelections(variant, trial, "axes") && isVariantSellable(variant),
                    );
                  }}
                  onSelect={(value) => selectAxisValue(axis.kind, value)}
                />
              ))}
              {selected ? (
                <p className="text-sm" style={{ color: "var(--site-muted)" }}>
                  Sélection : <span className="font-medium text-[inherit]">{selected.name}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <p className={`mt-6 text-sm font-medium ${inStock ? "text-emerald-600" : "text-red-600"}`}>
            {inStock ? "En stock · expédié sous 24 h" : "Rupture de stock"}
          </p>

          <div className="mt-5 inline-flex items-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--site-border)" }}>
            <button
              type="button"
              aria-label="Diminuer la quantité"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="grid size-10 place-items-center text-lg disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-10 text-center text-sm font-medium">{quantity}</span>
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => setQuantity((value) => value + 1)}
              className="grid size-10 place-items-center text-lg"
            >
              +
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(false)}
              className="rounded-full bg-neutral-950 px-5 py-3.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Ajouter au panier
            </button>
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(true)}
              className="rounded-full px-5 py-3.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--site-primary)" }}
            >
              Acheter maintenant
            </button>
          </div>

          <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--site-muted)" }}>
            Paiement Wave, Orange Money ou MTN MoMo · Livraison {city} sous 24 h
          </p>
        </div>
      </div>

      <ProductReviews
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        productSlug={product.slug}
        layoutKey={site?.theme?.layoutKey}
      />

      {related.length > 0 ? (
        <section className="mt-14 sm:mt-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vous aimerez aussi</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => {
              const thumb = productImage(item.name, item.photos);
              return (
                <Link key={item.slug} href={storeHref(basePath, `/produit/${item.slug}`)} className="min-w-0 block">
                  <div
                    className="overflow-hidden rounded-[22px]"
                    style={{ background: light ? "var(--site-card)" : "rgba(255,255,255,0.06)" }}
                  >
                    <img src={thumb} alt="" className="aspect-[4/5] w-full object-cover" />
                  </div>
                  <h3 className="mt-3 truncate text-sm font-semibold">{item.name}</h3>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
                    {formatPriceXof(item.priceXof)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function OptionRow({
  label,
  kind,
  values,
  selected,
  light,
  thumbs,
  isUnavailable,
  onSelect,
}: {
  label: string;
  kind: string | null;
  values: string[];
  selected: string | null;
  light: boolean;
  thumbs: Map<string, string>;
  isUnavailable: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  const display = optionDisplayMode(kind);
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {values.map((value) => {
          const active = value === selected;
          const unavailable = isUnavailable(value);
          const thumb = thumbs.get(value);
          const color = display === "color" ? resolveColorSwatch(value) : null;

          if (display === "image" || (display === "color" && !color && thumb)) {
            return (
              <button
                key={value}
                type="button"
                title={value}
                aria-label={value}
                aria-pressed={active}
                disabled={unavailable && !active}
                onClick={() => onSelect(value)}
                className="relative size-11 overflow-hidden rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ borderColor: active ? "#111111" : "var(--site-border)" }}
              >
                {thumb ? (
                  <img
                    src={colorSwatchUrl(thumb)}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    style={{ transform: "scale(3.2)", transformOrigin: "center center" }}
                  />
                ) : (
                  <span
                    className="grid size-full place-items-center text-[10px] font-medium"
                    style={{ background: light ? "#f4f4f5" : "rgba(255,255,255,0.08)" }}
                  >
                    {value.slice(0, 2)}
                  </span>
                )}
                {unavailable ? (
                  <span className="absolute inset-0 bg-white/45" aria-hidden />
                ) : null}
              </button>
            );
          }

          if (display === "color" && color) {
            return (
              <button
                key={value}
                type="button"
                title={value}
                aria-label={value}
                aria-pressed={active}
                disabled={unavailable && !active}
                onClick={() => onSelect(value)}
                className="size-11 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{
                  background: color,
                  borderColor: active ? "#111111" : color === "#ffffff" ? "#d4d4d8" : "transparent",
                  boxShadow: active ? "0 0 0 1px #111111" : undefined,
                }}
              />
            );
          }

          return (
            <button
              key={value}
              type="button"
              disabled={unavailable && !active}
              onClick={() => onSelect(value)}
              className="min-w-10 rounded-full px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35"
              style={
                active
                  ? { background: "#111111", color: "#ffffff" }
                  : {
                      background: light ? "#ffffff" : "transparent",
                      color: "inherit",
                      border: "1px solid var(--site-border)",
                      textDecoration: unavailable ? "line-through" : undefined,
                    }
              }
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function optionDisplayMode(kind: string | null): "color" | "image" | "text" {
  const normalized = (kind || "").trim().toLowerCase();
  // Couleur : pastilles = photos produit (comme Shein)
  if (normalized === "couleur" || normalized === "motif" || normalized === "imprimé" || normalized === "imprime") {
    return "image";
  }
  return "text";
}

/** Pastille = échantillon zoomé (pas la vue produit entière). */
function colorSwatchUrl(url: string) {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;
  const head = url.slice(0, index + marker.length);
  const tail = url.slice(index + marker.length);
  if (tail.startsWith("c_") || tail.startsWith("w_") || tail.startsWith("f_")) return url;
  // Échantillon matière : crop centré zoomé (pas la silhouette produit)
  return `${head}c_thumb,g_center,z_2,w_96,h_96,f_auto,q_auto/${tail}`;
}

function resolveColorSwatch(raw: string) {
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return COLOR_SWATCHES[key] ?? null;
}

const COLOR_SWATCHES: Record<string, string> = {
  rouge: "#dc2626",
  rose: "#fb7185",
  bordeaux: "#7f1d1d",
  orange: "#ea580c",
  jaune: "#eab308",
  vert: "#16a34a",
  "vert olive": "#556b2f",
  bleu: "#2563eb",
  "bleu marine": "#1e3a8a",
  marine: "#1e3a8a",
  turquoise: "#14b8a6",
  violet: "#7c3aed",
  mauve: "#a78bfa",
  noir: "#111111",
  blanc: "#ffffff",
  beige: "#e7d3b0",
  marron: "#78350f",
  brun: "#92400e",
  gris: "#9ca3af",
  argente: "#c0c0c0",
  argent: "#c0c0c0",
  dore: "#d4af37",
  or: "#d4af37",
  camel: "#c19a6b",
  kaki: "#6b7c3c",
  ivoire: "#fffff0",
  creme: "#fffdd0",
};

type OptionAxis = { kind: string; values: string[] };
type OptionModel = { mode: "flat" | "axes"; axes: OptionAxis[] };

function variantOptions(variant: StorefrontVariant) {
  if (variant.options?.length) return variant.options;
  const legacy: Array<{ kind: string; value: string }> = [];
  if (variant.option1Kind && variant.option1Value) {
    legacy.push({ kind: variant.option1Kind, value: variant.option1Value });
  }
  if (variant.option2Kind && variant.option2Value) {
    legacy.push({ kind: variant.option2Kind, value: variant.option2Value });
  }
  return legacy;
}

function buildOptionModel(variants: StorefrontVariant[]): OptionModel {
  const rows = variants.map((variant) => ({ variant, options: variantOptions(variant) }));
  const hasAxes = rows.some((row) => row.options.length > 0);
  if (!hasAxes) {
    return {
      mode: "flat",
      axes: [{ kind: "Variante", values: variants.map((variant) => variant.name) }],
    };
  }
  const kindOrder: string[] = [];
  for (const row of rows) {
    for (const option of row.options) {
      if (!kindOrder.includes(option.kind)) kindOrder.push(option.kind);
    }
  }
  return {
    mode: "axes",
    axes: kindOrder.map((kind) => ({
      kind,
      values: unique(
        rows.flatMap((row) => row.options.filter((option) => option.kind === kind).map((option) => option.value)),
      ),
    })),
  };
}

function initialSelections(model: OptionModel) {
  const selections: Record<string, string> = {};
  for (const axis of model.axes) {
    if (axis.values[0]) selections[axis.kind] = axis.values[0];
  }
  return selections;
}

function variantMatchesSelections(
  variant: StorefrontVariant,
  selections: Record<string, string>,
  mode: "flat" | "axes",
) {
  if (mode === "flat") {
    return variant.name === selections.Variante;
  }
  const options = variantOptions(variant);
  return Object.entries(selections).every(([kind, value]) =>
    options.some((option) => option.kind === kind && option.value === value),
  );
}

function isVariantSellable(variant: StorefrontVariant) {
  return variant.availability !== "OUT_OF_STOCK" && variant.stockQty !== 0;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
