"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { StorefrontCatalog, StorefrontProduct, TenantPublic } from "@boutik/sdk";
import { resolveHomeBlocks } from "../lib/home-blocks";
import { googleMapsDirectionsUrl } from "../lib/maps";
import { formatPriceXof, isLightLayout, productImage, resolveLayout, themeStyle } from "../lib/theme";
import { storeHref } from "../lib/store-paths";
import { CartProvider, useCart } from "./boutique/cart-context";
import { CoverImage } from "./boutique/cover-image";
import { Reveal } from "./boutique/reveal";

export function BoutiqueSite({
  tenant,
  catalog,
  basePath = "",
}: {
  tenant: TenantPublic;
  catalog: StorefrontCatalog;
  basePath?: string;
}) {
  const site = tenant.site;
  const theme = site?.theme ?? {
    layoutKey: "eclat",
    primaryColor: "#6b4c9a",
    secondaryColor: "#0f3d3a",
    backgroundColor: "#ffffff",
    textColor: "#171717",
    logoUrl: null,
    coverUrl: null,
    bannerUrl: null,
    faviconUrl: null,
  };
  const layout = resolveLayout(theme.layoutKey);
  const light = isLightLayout(layout);
  const eclat = layout === "eclat";
  const mark = (tenant.name.trim() || "b").slice(0, 1).toLowerCase();
  const city = site?.contact.city || tenant.contact?.city || "Abidjan";
  const phone = site?.contact.phone || tenant.contact?.phone || "";
  const email = site?.contact.email || tenant.contact?.email || "";
  const addressLine = site?.contact.addressLine || tenant.contact?.addressLine || "";
  const addressCity = site?.contact.city || tenant.contact?.city || "";
  const address = [addressLine, addressCity].filter(Boolean).join(", ");
  const social = site?.social;
  const socialLinks = [
    { label: "Instagram", href: social?.instagramUrl },
    { label: "TikTok", href: social?.tiktokUrl },
    { label: "Facebook", href: social?.facebookUrl },
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));
  const blocks = resolveHomeBlocks(site?.pages);
  const tagline =
    site?.general.tagline ||
    site?.general.about ||
    tenant.description ||
    "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.";
  const aboutText = blocks.aboutBody || site?.general.about || tagline;
  const cover = theme.coverUrl || "/landing/boutique-hero.jpg";
  const products = catalog.products;
  const featuredProducts = products.filter((product) => product.isFeatured);
  const featured = (featuredProducts.length ? featuredProducts : products).slice(0, 4);

  const catalogLabel =
    tenant.category === "RESTAURANT" ? "Notre carte" : tenant.category === "VITRINE" ? "Nos services" : "Toute la boutique";
  const featuredLabel =
    blocks.featuredTitle !== "Produits mis en avant"
      ? blocks.featuredTitle
      : tenant.category === "RESTAURANT"
        ? "Plats mis en avant"
        : tenant.category === "VITRINE"
          ? "Services mis en avant"
          : "Produits mis en avant";
  const productHref = (productSlug: string) => storeHref(basePath, `/produit/${productSlug}`);

  return (
    <CartProvider tenantSlug={tenant.slug}>
    <BoutiqueSiteInner
      tenant={tenant}
      catalog={catalog}
      basePath={basePath}
      theme={theme}
      layout={layout}
      light={light}
      eclat={eclat}
      mark={mark}
      city={city}
      phone={phone}
      email={email}
      address={address}
      socialLinks={socialLinks}
      tagline={tagline}
      aboutVisible={blocks.about}
      aboutTitle={blocks.aboutTitle}
      aboutText={aboutText}
      featuredVisible={blocks.featured}
      promotionsVisible={blocks.promotions}
      promotionsTitle={blocks.promotionsTitle}
      promotionsBody={blocks.promotionsBody}
      contactVisible={blocks.contact}
      contactTitle={blocks.contactTitle}
      cover={cover}
      featured={featured}
      products={products}
      catalogLabel={catalogLabel}
      featuredLabel={featuredLabel}
      productHref={productHref}
    />
    </CartProvider>
  );
}

function BoutiqueSiteInner({
  tenant,
  basePath,
  theme,
  layout,
  light,
  eclat,
  mark,
  city,
  phone,
  email,
  address,
  socialLinks,
  tagline,
  aboutVisible,
  aboutTitle,
  aboutText,
  featuredVisible,
  promotionsVisible,
  promotionsTitle,
  promotionsBody,
  contactVisible,
  contactTitle,
  cover,
  featured,
  products,
  catalogLabel,
  featuredLabel,
  productHref,
}: {
  tenant: TenantPublic;
  catalog: StorefrontCatalog;
  basePath: string;
  theme: NonNullable<TenantPublic["site"]>["theme"] | {
    layoutKey: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl: string | null;
    coverUrl: string | null;
    bannerUrl: string | null;
    faviconUrl: string | null;
  };
  layout: ReturnType<typeof resolveLayout>;
  light: boolean;
  eclat: boolean;
  mark: string;
  city: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: Array<{ label: string; href: string }>;
  tagline: string;
  aboutVisible: boolean;
  aboutTitle: string;
  aboutText: string;
  featuredVisible: boolean;
  promotionsVisible: boolean;
  promotionsTitle: string;
  promotionsBody: string | null;
  contactVisible: boolean;
  contactTitle: string;
  cover: string;
  featured: StorefrontProduct[];
  products: StorefrontProduct[];
  catalogLabel: string;
  featuredLabel: string;
  productHref: (slug: string) => string;
}) {
  const cart = useCart();
  const cartHref = storeHref(basePath, "/panier");
  const compteHref = storeHref(basePath, "/compte");
  const mapsHref = googleMapsDirectionsUrl(address);
  const promoProducts = products
    .filter((product) => Boolean(product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof))
    .slice(0, 4);

  return (
    <div className="min-h-screen" style={themeStyle(theme)}>
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--site-border)",
          background: eclat ? "color-mix(in srgb, var(--site-bg) 92%, transparent)" : "color-mix(in srgb, var(--site-bg) 88%, transparent)",
        }}
      >
        <div className="relative flex w-full items-center gap-3 py-3 pr-4 pl-5 sm:gap-4 sm:pr-6 sm:pl-7">
          <a href="#accueil" className="relative z-10 flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt={tenant.name} className="h-10 w-auto max-w-[11rem] object-contain object-left" />
            ) : (
              <>
                <span
                  className="grid size-9 place-items-center rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--site-primary)" }}
                >
                  {mark}
                </span>
                <span className="max-w-[8rem] truncate sm:max-w-none">{tenant.name}</span>
              </>
            )}
          </a>
          <nav
            className="absolute left-1/2 hidden min-w-0 -translate-x-1/2 items-center justify-center gap-3 overflow-x-auto text-[13px] whitespace-nowrap sm:flex sm:gap-5 sm:text-sm"
            style={{ color: "var(--site-muted)" }}
          >
            {featuredVisible ? (
              <a href="#mis-en-avant" className="hover:opacity-100" style={{ opacity: 0.85 }}>
                {featuredLabel}
              </a>
            ) : null}
            <a href="#boutique" className="hover:opacity-100" style={{ opacity: 0.85 }}>
              Catalogue
            </a>
            {aboutVisible ? (
              <a href="#apropos" className="hover:opacity-100" style={{ opacity: 0.85 }}>
                {aboutTitle}
              </a>
            ) : null}
            {contactVisible ? (
              <a href="#contact" className="hover:opacity-100" style={{ opacity: 0.85 }}>
                {contactTitle}
              </a>
            ) : null}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {tenant.category === "VITRINE" ? (
              <Link
                href="#boutique"
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--site-primary)" }}
              >
                Découvrir
              </Link>
            ) : (
              <Link
                href={cartHref}
                className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-neutral-950"
                style={{ borderColor: "var(--site-border)" }}
              >
                Panier
                <span
                  className="inline-grid size-5 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: "var(--site-primary)" }}
                >
                  {cart.count}
                </span>
              </Link>
            )}
            <Link
              href={compteHref}
              className="inline-flex items-center rounded-full border bg-white px-4 py-2 text-sm font-medium text-neutral-950"
              style={{ borderColor: "var(--site-border)" }}
            >
              Compte
            </Link>
          </div>
        </div>
      </header>

      <section id="accueil" className="relative overflow-hidden" style={{ background: "var(--site-hero)", color: "var(--site-hero-fg)" }}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
          {layout === "atelier" || layout === "minimal" ? (
            <>
              <CoverImage src={cover} className="cover-in h-72 w-full rounded-[28px] object-cover sm:h-[22rem]" />
              <HeroCopy city={city} tagline={tagline} category={tenant.category} layout={layout} />
            </>
          ) : (
            <>
              <HeroCopy city={city} tagline={tagline} category={tenant.category} layout={layout} />
              <CoverImage src={cover} className="cover-in h-72 w-full rounded-[28px] object-cover sm:h-[22rem]" />
            </>
          )}
        </div>
      </section>

      {featuredVisible && featured.length ? (
        <section id="mis-en-avant" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{featuredLabel}</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, index) => (
              <Reveal key={product.slug} delay={index * 70}>
                <ProductCard product={product} href={productHref(product.slug)} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section id="boutique" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{catalogLabel}</h2>
            <Link
              href={storeHref(basePath, "/catalogue")}
              className="soft rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
            >
              Tous les produits
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {products.slice(0, 4).map((product, index) => (
            <Reveal key={product.slug} delay={index * 70}>
              <ProductCard product={product} href={productHref(product.slug)} />
            </Reveal>
          ))}
        </div>
        {!products.length ? (
          <p className="mt-8 text-sm" style={{ color: "var(--site-muted)" }}>
            Aucun produit pour le moment.
          </p>
        ) : null}
      </section>

      {promotionsVisible ? (
        <section id="promotions" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Reveal>
            <div
              className="rounded-[28px] px-6 py-8 sm:px-8"
              style={{ background: "var(--site-hero)", color: "var(--site-hero-fg)" }}
            >
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{promotionsTitle}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--site-hero-muted)" }}>
                {promotionsBody || "Découvrez nos offres du moment."}
              </p>
              {promoProducts.length ? (
                <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
                  {promoProducts.map((product) => (
                    <ProductCard key={product.slug} product={product} href={productHref(product.slug)} />
                  ))}
                </div>
              ) : null}
            </div>
          </Reveal>
        </section>
      ) : null}

      {aboutVisible ? (
        <section id="apropos" className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <CoverImage src={cover} className="h-72 w-full rounded-[28px] object-cover sm:h-80" />
          </Reveal>
          <Reveal delay={120}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{aboutTitle}</h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--site-muted)" }}>
                {aboutText}
              </p>
            </div>
          </Reveal>
        </section>
      ) : null}

      {contactVisible ? (
      <section id="contact" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
        <div className="rounded-[28px] px-6 py-8 sm:px-8" style={{ background: "var(--site-card)" }}>
          <h2 className="text-3xl font-semibold tracking-tight">{contactTitle}</h2>
          <dl className="mt-6 space-y-3 text-sm">
            {phone ? (
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "var(--site-muted)" }}>Téléphone</dt>
                <dd>{phone}</dd>
              </div>
            ) : null}
            {email ? (
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "var(--site-muted)" }}>Email</dt>
                <dd>{email}</dd>
              </div>
            ) : null}
            {address ? (
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "var(--site-muted)" }}>Adresse</dt>
                <dd>{address}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="soft rounded-full px-4 py-2 text-sm font-medium"
                style={contactActionStyle(light)}
              >
                Appeler
              </a>
            ) : null}
            {phone ? (
              <a
                href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`}
                className="soft rounded-full px-4 py-2 text-sm font-medium"
                style={contactActionStyle(light)}
              >
                WhatsApp
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="soft rounded-full px-4 py-2 text-sm font-medium" style={contactActionStyle(light)}>
                Email
              </a>
            ) : null}
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="soft rounded-full px-4 py-2 text-sm font-medium"
                style={contactActionStyle(light)}
              >
                Itinéraire
              </a>
            ) : null}
            <a
              href={email ? `mailto:${email}` : "#contact"}
              className="soft rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--site-primary)" }}
            >
              Nous écrire
            </a>
          </div>
        </div>
        </Reveal>
      </section>
      ) : null}

      <footer className="px-4 py-8 sm:px-6" style={{ background: "var(--site-secondary)", color: "#fff" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-semibold">{mark}</p>
            {address ? <p className="mt-2 text-sm text-white/70">{address}</p> : null}
            <p className="mt-1 text-sm text-white/70">
              {[phone, "Lun – Sam · 9 h – 19 h"].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-3 text-xs text-white/50">
              © {new Date().getFullYear()} {mark}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90"
              >
                {item.label}
              </a>
            ))}
            {phone ? (
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
                Appeler
              </a>
            ) : null}
            {phone ? (
              <a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
                WhatsApp
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90">
                Email
              </a>
            ) : null}
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90"
              >
                Itinéraire
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

function contactActionStyle(light: boolean): CSSProperties {
  if (light) {
    return { background: "#ffffff", color: "#171717", border: "1px solid rgba(23,23,23,0.08)" };
  }
  return { background: "#111111", color: "#ffffff" };
}

function HeroCopy({
  city,
  tagline,
  category,
  layout,
}: {
  city: string;
  tagline: string;
  category: string;
  layout: string;
}) {
  const eclat = layout === "eclat";
  const darkHero = eclat || layout === "nocturne";
  const eyebrow =
    category === "RESTAURANT" ? `RESTAURANT · ${city.toUpperCase()}` : category === "VITRINE" ? `SITE · ${city.toUpperCase()}` : `BOUTIQUE · ${city.toUpperCase()}`;
  return (
    <div>
      <p className="rise text-xs font-medium tracking-[0.18em] uppercase" style={{ color: "var(--site-hero-muted)" }}>
        {eyebrow}
      </p>
      <h1 className="rise rise-delay-1 mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{tagline}</h1>
      <div className="rise rise-delay-2 mt-7 flex flex-wrap gap-3">
        <a
          href="#boutique"
          className="soft rounded-full px-5 py-3 text-sm font-medium"
          style={
            darkHero
              ? { background: "#ffffff", color: "#171717" }
              : { background: "var(--site-primary)", color: "#ffffff" }
          }
        >
          {category === "RESTAURANT" ? "Voir la carte" : category === "VITRINE" ? "Découvrir" : "Découvrir la boutique"}
        </a>
        <a
          href="#contact"
          className="soft rounded-full border px-5 py-3 text-sm font-medium"
          style={{
            borderColor: darkHero ? "rgba(255,255,255,0.35)" : "var(--site-border)",
            color: darkHero ? "#ffffff" : "inherit",
          }}
        >
          Nous contacter
        </a>
      </div>
    </div>
  );
}

function ProductCard({ product, href }: { product: StorefrontProduct; href: string }) {
  const image = productImage(product.name, product.photos);
  const promo = Boolean(product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof);
  const rupture = product.availability === "OUT_OF_STOCK";
  return (
    <Link href={href} className="product-lift group min-w-0 block">
      <div className="relative overflow-hidden rounded-[22px]" style={{ background: "var(--site-card)" }}>
        <img src={image} alt="" className="zoom-img aspect-[4/5] w-full object-cover" />
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
      <h3 className="mt-1 truncate text-sm font-semibold">{product.name}</h3>
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
