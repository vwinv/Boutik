"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TenantPublic } from "@boutik/sdk";
import { googleMapsDirectionsUrl } from "../../lib/maps";
import { resolveLayout, themeStyle } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { CartProvider, useCart } from "./cart-context";

export function StoreShell({
  tenant,
  basePath,
  children,
}: {
  tenant: TenantPublic;
  basePath: string;
  children: ReactNode;
}) {
  return (
    <CartProvider tenantSlug={tenant.slug}>
      <StoreChrome tenant={tenant} basePath={basePath}>
        {children}
      </StoreChrome>
    </CartProvider>
  );
}

function StoreChrome({
  tenant,
  basePath,
  children,
}: {
  tenant: TenantPublic;
  basePath: string;
  children: ReactNode;
}) {
  const site = tenant.site;
  const theme = site?.theme ?? {
    layoutKey: "eclat",
    primaryColor: "#6b4c9a",
    secondaryColor: "#111111",
    backgroundColor: "#ffffff",
    textColor: "#171717",
    logoUrl: null,
    coverUrl: null,
    bannerUrl: null,
    faviconUrl: null,
  };
  const layout = resolveLayout(theme.layoutKey);
  const eclat = layout === "eclat";
  const mark = (tenant.name.trim() || "b").slice(0, 1).toLowerCase();
  const homeHref = storeHref(basePath, "/");
  const cartHref = storeHref(basePath, "/panier");
  const compteHref = storeHref(basePath, "/compte");
  const cart = useCart();
  const showCart = tenant.category !== "VITRINE";
  const phone = site?.contact.phone || tenant.contact?.phone || "";
  const email = site?.contact.email || tenant.contact?.email || "";
  const address = [site?.contact.addressLine || tenant.contact?.addressLine, site?.contact.city || tenant.contact?.city]
    .filter(Boolean)
    .join(", ");
  const mapsHref = googleMapsDirectionsUrl(address);
  const social = [
    { label: "Instagram", href: site?.social?.instagramUrl },
    { label: "TikTok", href: site?.social?.tiktokUrl },
    { label: "Facebook", href: site?.social?.facebookUrl },
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));

  return (
    <div className="min-h-screen" style={themeStyle(theme)}>
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--site-border)",
          background: eclat
            ? "color-mix(in srgb, var(--site-bg) 92%, transparent)"
            : "color-mix(in srgb, var(--site-bg) 88%, transparent)",
        }}
      >
        <div className="relative flex w-full items-center gap-3 py-3 pr-4 pl-5 sm:gap-4 sm:pr-6 sm:pl-7">
          <Link href={homeHref} className="relative z-10 flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
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
          </Link>
          <nav
            className="absolute left-1/2 hidden min-w-0 -translate-x-1/2 items-center justify-center gap-3 text-[13px] whitespace-nowrap sm:flex sm:gap-5 sm:text-sm"
            style={{ color: "var(--site-muted)" }}
          >
            <Link href={`${homeHref}#mis-en-avant`} className="hover:opacity-100" style={{ opacity: 0.85 }}>
              Produits mis en avant
            </Link>
            <Link href={storeHref(basePath, "/catalogue")} className="hover:opacity-100" style={{ opacity: 0.85 }}>
              Catalogue
            </Link>
            <Link href={`${homeHref}#apropos`} className="hover:opacity-100" style={{ opacity: 0.85 }}>
              À propos
            </Link>
            <Link href={`${homeHref}#contact`} className="hover:opacity-100" style={{ opacity: 0.85 }}>
              Contact
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showCart ? (
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
            ) : null}
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

      {children}

      <footer className="mt-8 px-4 py-8 sm:px-6" style={{ background: "var(--site-secondary)", color: "#fff" }}>
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
            {social.map((item) => (
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
              <a
                href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`}
                className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white/90"
              >
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
        <p className="mx-auto mt-6 max-w-6xl text-right text-xs text-white/45">Propulsé par Boutik</p>
      </footer>
    </div>
  );
}
