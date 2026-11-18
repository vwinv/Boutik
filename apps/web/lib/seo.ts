import type { Metadata } from "next";
import type { StorefrontProduct, TenantPublic } from "@boutik/sdk";
import { publicOrigin } from "@boutik/domain";
import { storeHref } from "./store-paths";

function absoluteUrl(pathOrUrl: string, origin = publicOrigin()) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = origin.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export function storefrontCanonical(tenant: TenantPublic, basePath: string, path = "/") {
  const siteUrl = tenant.site?.url?.replace(/\/$/, "");
  if (siteUrl) {
    const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
    return `${siteUrl}${suffix}`;
  }
  return absoluteUrl(storeHref(basePath, path));
}

export function storefrontMetadata(input: {
  tenant: TenantPublic;
  basePath: string;
  path?: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  noIndex?: boolean;
}): Metadata {
  const { tenant, basePath } = input;
  const brand = tenant.site?.general.title || tenant.name;
  const seo = tenant.site?.seo;
  const title = (input.title || seo?.title || brand).trim();
  const description = (
    input.description ||
    seo?.description ||
    tenant.site?.general.tagline ||
    tenant.description ||
    `${brand} — boutique en ligne`
  )
    .trim()
    .slice(0, 200);
  const image =
    input.image ||
    seo?.ogImageUrl ||
    tenant.site?.theme.coverUrl ||
    tenant.site?.theme.logoUrl ||
    null;
  const canonical = storefrontCanonical(tenant, basePath, input.path || "/");
  const keywords = seo?.keywords
    ?.split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    title,
    description,
    keywords: keywords?.length ? keywords : undefined,
    alternates: { canonical },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    icons: tenant.site?.theme.faviconUrl
      ? { icon: tenant.site.theme.faviconUrl }
      : tenant.site?.theme.logoUrl
        ? { icon: tenant.site.theme.logoUrl }
        : undefined,
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: canonical,
      siteName: brand,
      title,
      description,
      images: image ? [{ url: absoluteUrl(image) }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [absoluteUrl(image)] : undefined,
    },
  };
}

export function productMetadata(input: {
  tenant: TenantPublic;
  product: StorefrontProduct;
  basePath: string;
}): Metadata {
  const { tenant, product, basePath } = input;
  const brand = tenant.site?.general.title || tenant.name;
  const photo = [...(product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url;
  return storefrontMetadata({
    tenant,
    basePath,
    path: `/produit/${product.slug}`,
    title: `${product.name} | ${brand}`,
    description: product.description?.trim() || `${product.name} chez ${brand}`,
    image: photo || null,
  });
}

export function localBusinessJsonLd(tenant: TenantPublic, basePath: string) {
  const brand = tenant.site?.general.title || tenant.name;
  const url = storefrontCanonical(tenant, basePath, "/");
  const contact = tenant.site?.contact || tenant.contact;
  return {
    "@context": "https://schema.org",
    "@type": tenant.category === "RESTAURANT" ? "Restaurant" : "Store",
    name: brand,
    description: tenant.site?.seo?.description || tenant.site?.general.tagline || tenant.description || undefined,
    url,
    image: tenant.site?.theme.coverUrl || tenant.site?.theme.logoUrl || undefined,
    telephone: contact?.phone || undefined,
    email: contact?.email || undefined,
    address: contact?.city
      ? {
          "@type": "PostalAddress",
          streetAddress: contact.addressLine || undefined,
          addressLocality: contact.city,
          addressCountry: tenant.contact?.country || "CI",
        }
      : undefined,
  };
}

export function productJsonLd(input: {
  tenant: TenantPublic;
  product: StorefrontProduct;
  basePath: string;
}) {
  const { tenant, product, basePath } = input;
  const url = storefrontCanonical(tenant, basePath, `/produit/${product.slug}`);
  const photo = [...(product.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: photo ? [photo] : undefined,
    sku: product.slug,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency || tenant.currency || "XOF",
      price: product.priceXof,
      availability:
        product.availability === "OUT_OF_STOCK"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
  };
}
