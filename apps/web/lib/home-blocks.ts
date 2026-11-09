import type { TenantPublic } from "@boutik/sdk";

export type HomeBlocks = {
  hero: boolean;
  featured: boolean;
  featuredTitle: string;
  promotions: boolean;
  promotionsTitle: string;
  promotionsBody: string | null;
  about: boolean;
  aboutTitle: string;
  aboutBody: string | null;
  reviews: boolean;
  reviewsTitle: string;
  reviewsBody: string | null;
  gallery: boolean;
  galleryTitle: string;
  newsletter: boolean;
  newsletterTitle: string;
  newsletterBody: string | null;
  faq: boolean;
  faqTitle: string;
  faqBody: string | null;
  contact: boolean;
  contactTitle: string;
};

export function resolveHomeBlocks(pages: NonNullable<TenantPublic["site"]>["pages"] | undefined): HomeBlocks {
  const list = Array.isArray(pages) ? pages : [];
  const home = list.find((page) => page.isHome) || list[0];
  const contactPage = list.find((page) => page.slug === "contact");
  const sections = home?.sections ?? [];
  const hasMarkers =
    sections.some((section) => /^@boutik-block:/.test(section.body || "")) ||
    sections.some((section) => section.type === "HERO");

  // Sites not yet configured via Pages & contenus: keep previous full layout.
  if (!hasMarkers) {
    return {
      hero: true,
      featured: true,
      featuredTitle: "Produits mis en avant",
      promotions: false,
      promotionsTitle: "Promotions",
      promotionsBody: null,
      about: true,
      aboutTitle: "À propos",
      aboutBody: null,
      reviews: false,
      reviewsTitle: "Avis clients",
      reviewsBody: null,
      gallery: false,
      galleryTitle: "Galerie",
      newsletter: false,
      newsletterTitle: "Newsletter",
      newsletterBody: null,
      faq: false,
      faqTitle: "FAQ",
      faqBody: null,
      contact: true,
      contactTitle: contactPage?.title || "Contact",
    };
  }

  const find = (key: string) =>
    sections.find((section) => {
      const match = section.body?.match(/^@boutik-block:([a-z-]+)/m);
      if (match?.[1] === key) return true;
      return key === "hero" && section.type === "HERO" && !match;
    });

  const bodyOf = (key: string) => {
    const section = find(key);
    if (!section?.body) return null;
    return section.body.replace(/^@boutik-block:[a-z-]+\n?/, "").trim() || null;
  };

  return {
    hero: Boolean(find("hero")),
    featured: Boolean(find("featured")),
    featuredTitle: find("featured")?.title || "Produits mis en avant",
    promotions: Boolean(find("promotions")),
    promotionsTitle: find("promotions")?.title || "Promotions",
    promotionsBody: bodyOf("promotions"),
    about: Boolean(find("about")),
    aboutTitle: find("about")?.title || "À propos",
    aboutBody: bodyOf("about"),
    reviews: Boolean(find("reviews")),
    reviewsTitle: find("reviews")?.title || "Avis clients",
    reviewsBody: bodyOf("reviews"),
    gallery: Boolean(find("gallery")),
    galleryTitle: find("gallery")?.title || "Galerie",
    newsletter: Boolean(find("newsletter")),
    newsletterTitle: find("newsletter")?.title || "Newsletter",
    newsletterBody: bodyOf("newsletter"),
    faq: Boolean(find("faq")),
    faqTitle: find("faq")?.title || "FAQ",
    faqBody: bodyOf("faq"),
  // La page Contact (visible) pilote la section Contact de l’accueil.
  contact: Boolean(contactPage),
  contactTitle: contactPage?.title || "Contact",
};
}
