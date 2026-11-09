"use client";

import Link from "next/link";
import type { StorefrontCatalog, TenantPublic } from "@boutik/sdk";
import { resolveHomeBlocks } from "../../lib/home-blocks";
import { googleMapsDirectionsUrl } from "../../lib/maps";
import { isLightLayout, resolveLayout } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { CoverImage } from "./cover-image";
import { ProductCard } from "./product-card";

export function HomeView({
  tenant,
  catalog,
  basePath,
}: {
  tenant: TenantPublic;
  catalog: StorefrontCatalog;
  basePath: string;
}) {
  const site = tenant.site;
  const theme = site?.theme;
  const layout = resolveLayout(theme?.layoutKey);
  const light = isLightLayout(layout);
  const eclat = layout === "eclat";
  const city = site?.contact.city || tenant.contact?.city || "Abidjan";
  const phone = site?.contact.phone || tenant.contact?.phone || "";
  const email = site?.contact.email || tenant.contact?.email || "";
  const address = [site?.contact.addressLine || tenant.contact?.addressLine, site?.contact.city || tenant.contact?.city]
    .filter(Boolean)
    .join(", ");
  const mapsHref = googleMapsDirectionsUrl(address);
  const tagline =
    site?.general.tagline ||
    site?.general.about ||
    tenant.description ||
    "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.";
  const cover = theme?.coverUrl || "/landing/boutique-hero.jpg";
  const featured = catalog.products.slice(0, 4);
  const catalogueHref = storeHref(basePath, "/catalogue");
  const darkHero = eclat || layout === "nocturne";
  const blocks = resolveHomeBlocks(site?.pages);
  const aboutText =
    blocks.aboutBody ||
    site?.general.about ||
    tagline;

  const eyebrow =
    tenant.category === "RESTAURANT"
      ? `RESTAURANT · ${city.toUpperCase()}`
      : tenant.category === "VITRINE"
        ? `SITE · ${city.toUpperCase()}`
        : `BOUTIQUE · ${city.toUpperCase()}`;

  return (
    <>
      {blocks.hero ? (
        <section id="accueil" className="relative overflow-hidden" style={{ background: "var(--site-hero)", color: "var(--site-hero-fg)" }}>
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
            {layout === "atelier" || layout === "minimal" ? (
              <>
                <CoverImage src={cover} className="h-72 w-full rounded-[28px] object-cover sm:h-[22rem]" />
                <HeroCopy
                  eyebrow={eyebrow}
                  tagline={tagline}
                  catalogueHref={catalogueHref}
                  eclat={eclat}
                  darkHero={darkHero}
                  category={tenant.category}
                />
              </>
            ) : (
              <>
                <HeroCopy
                  eyebrow={eyebrow}
                  tagline={tagline}
                  catalogueHref={catalogueHref}
                  eclat={eclat}
                  darkHero={darkHero}
                  category={tenant.category}
                />
                <CoverImage src={cover} className="h-72 w-full rounded-[28px] object-cover sm:h-[22rem]" />
              </>
            )}
          </div>
        </section>
      ) : null}

      {blocks.featured && featured.length ? (
        <section id="mis-en-avant" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{blocks.featuredTitle}</h2>
            <Link href={catalogueHref} className="text-sm font-medium" style={{ color: "var(--site-primary)" }}>
              Voir le catalogue →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {blocks.promotions ? (
        <section id="promotions" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="rounded-[28px] px-6 py-8 sm:px-8" style={{ background: "var(--site-card)" }}>
            <h2 className="text-3xl font-semibold tracking-tight">{blocks.promotionsTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
              {blocks.promotionsBody || "Découvrez nos offres du moment."}
            </p>
          </div>
        </section>
      ) : null}

      {blocks.about ? (
        <section id="apropos" className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2">
          <CoverImage src={cover} className="h-72 w-full rounded-[28px] object-cover sm:h-80" />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{blocks.aboutTitle}</h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--site-muted)" }}>
              {aboutText}
            </p>
          </div>
        </section>
      ) : null}

      {blocks.gallery ? (
        <section id="galerie" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{blocks.galleryTitle}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <CoverImage src={cover} className="h-56 w-full rounded-[24px] object-cover" />
            <CoverImage src={cover} className="h-56 w-full rounded-[24px] object-cover opacity-80" />
          </div>
        </section>
      ) : null}

      {blocks.faq ? (
        <section id="faq" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{blocks.faqTitle}</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--site-muted)" }}>
            {blocks.faqBody || "Les questions fréquentes seront affichées ici."}
          </p>
        </section>
      ) : null}

      {blocks.contact ? (
        <section id="contact" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="rounded-[28px] px-6 py-8 sm:px-8" style={{ background: "var(--site-card)" }}>
            <h2 className="text-3xl font-semibold tracking-tight">{blocks.contactTitle}</h2>
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
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="rounded-full px-4 py-2 text-sm font-medium" style={actionStyle(light)}>
                  Appeler
                </a>
              ) : null}
              {phone ? (
                <a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`} className="rounded-full px-4 py-2 text-sm font-medium" style={actionStyle(light)}>
                  WhatsApp
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="rounded-full px-4 py-2 text-sm font-medium" style={actionStyle(light)}>
                  Email
                </a>
              ) : null}
              {mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={actionStyle(light)}
                >
                  Itinéraire
                </a>
              ) : null}
              <a
                href={email ? `mailto:${email}` : "#contact"}
                className="rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--site-primary)" }}
              >
                Nous écrire
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function actionStyle(light: boolean) {
  if (light) return { background: "#ffffff", color: "#171717", border: "1px solid rgba(23,23,23,0.08)" };
  return { background: "#111111", color: "#ffffff" };
}

function HeroCopy({
  eyebrow,
  tagline,
  catalogueHref,
  eclat,
  darkHero,
  category,
}: {
  eyebrow: string;
  tagline: string;
  catalogueHref: string;
  eclat: boolean;
  darkHero: boolean;
  category: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.18em] uppercase" style={{ color: "var(--site-hero-muted)" }}>
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{tagline}</h1>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href={catalogueHref}
          className="rounded-full px-5 py-3 text-sm font-medium"
          style={darkHero ? { background: "#ffffff", color: "#171717" } : { background: "var(--site-primary)", color: "#ffffff" }}
        >
          {category === "RESTAURANT" ? "Voir la carte" : category === "VITRINE" ? "Découvrir" : "Découvrir la boutique"}
        </Link>
        <a
          href="#contact"
          className="rounded-full border px-5 py-3 text-sm font-medium"
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
