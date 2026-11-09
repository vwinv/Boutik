"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StorefrontCatalog, TenantPublic } from "@boutik/sdk";
import { formatPriceXof, productImage } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { StoreShell } from "./store-shell";

export function CatalogPage({
  tenant,
  catalog,
  basePath,
}: {
  tenant: TenantPublic;
  catalog: StorefrontCatalog;
  basePath: string;
}) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <CatalogView tenant={tenant} catalog={catalog} basePath={basePath} />
    </StoreShell>
  );
}

function CatalogView({
  tenant,
  catalog,
  basePath,
}: {
  tenant: TenantPublic;
  catalog: StorefrontCatalog;
  basePath: string;
}) {
  const [activeCategory, setActiveCategory] = useState("tous");

  const allLabel =
    tenant.category === "RESTAURANT"
      ? "Tous les plats"
      : tenant.category === "VITRINE"
        ? "Tous les services"
        : "Tous les produits";

  const filtered = useMemo(() => {
    if (activeCategory === "tous") return catalog.products;
    return catalog.products.filter((product) => product.category?.slug === activeCategory);
  }, [catalog.products, activeCategory]);

  const activeName =
    activeCategory === "tous"
      ? allLabel
      : catalog.categories.find((category) => category.slug === activeCategory)?.name || allLabel;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="w-full shrink-0 lg:w-56">
          <p className="text-xs font-medium tracking-[0.14em] uppercase" style={{ color: "var(--site-muted)" }}>
            Catégories
          </p>
          <nav
            className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
            aria-label="Catégories"
          >
            <CategoryLink
              label={allLabel}
              active={activeCategory === "tous"}
              onClick={() => setActiveCategory("tous")}
            />
            {catalog.categories.map((category) => (
              <CategoryLink
                key={category.slug}
                label={category.name}
                active={activeCategory === category.slug}
                onClick={() => setActiveCategory(category.slug)}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{activeName}</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--site-muted)" }}>
                {filtered.length} {filtered.length > 1 ? "articles" : "article"}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-3">
            {filtered.map((product) => (
              <CatalogProductCard
                key={product.slug}
                product={product}
                href={storeHref(basePath, `/produit/${product.slug}`)}
              />
            ))}
          </div>
          {!filtered.length ? (
            <p className="mt-8 text-sm" style={{ color: "var(--site-muted)" }}>
              Aucun produit dans cette catégorie.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CategoryLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors lg:w-full lg:rounded-xl"
      style={
        active
          ? {
              background: "var(--site-primary)",
              color: "#ffffff",
            }
          : {
              background: "transparent",
              color: "inherit",
              border: "1px solid transparent",
            }
      }
      onMouseEnter={(event) => {
        if (active) return;
        event.currentTarget.style.background = "var(--site-card)";
        event.currentTarget.style.borderColor = "var(--site-border)";
      }}
      onMouseLeave={(event) => {
        if (active) return;
        event.currentTarget.style.background = "transparent";
        event.currentTarget.style.borderColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function CatalogProductCard({
  product,
  href,
}: {
  product: StorefrontCatalog["products"][number];
  href: string;
}) {
  const image = productImage(product.name, product.photos);
  const promo = Boolean(product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof);
  const rupture = product.availability === "OUT_OF_STOCK";

  return (
    <Link href={href} className="min-w-0 block">
      <div className="relative overflow-hidden rounded-[22px]" style={{ background: "var(--site-card)" }}>
        <img src={image} alt="" className="aspect-[4/5] w-full object-cover" />
        {promo ? (
          <span
            className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
            style={{ background: "var(--site-primary)" }}
          >
            Promo
          </span>
        ) : null}
        {rupture ? (
          <span className="absolute top-3 right-3 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white">
            Rupture
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--site-muted)" }}>
        {product.category?.name || "Produits"}
      </p>
      <h2 className="mt-1 truncate text-sm font-semibold">{product.name}</h2>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
        {formatPriceXof(product.priceXof)}
      </p>
      {promo ? (
        <p className="text-xs line-through" style={{ color: "var(--site-muted)" }}>
          {formatPriceXof(product.compareAtPriceXof!)}
        </p>
      ) : null}
    </Link>
  );
}
