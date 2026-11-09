export type LayoutKey = "eclat" | "minimal" | "atelier" | "nocturne";

export type SiteTheme = {
  layoutKey: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
};

const LAYOUTS: Record<
  LayoutKey,
  {
    surface: string;
    muted: string;
    card: string;
    border: string;
    footer: string;
    text: string;
    heroGradient: (primary: string) => string;
  }
> = {
  // Éclat: hero couleur choisie → même teinte très sombre, corps blanc, footer = secondaire
  eclat: {
    surface: "#ffffff",
    muted: "rgba(23,23,23,0.58)",
    card: "#f3f3f4",
    border: "rgba(23,23,23,0.1)",
    footer: "#111111",
    text: "#171717",
    heroGradient: (primary) => eclatHeroGradient(primary),
  },
  // Nocturne = même structure qu'Éclat, fond sombre sur toutes les pages
  nocturne: {
    surface: "#08080c",
    muted: "rgba(255,255,255,0.62)",
    card: "#121218",
    border: "rgba(255,255,255,0.08)",
    footer: "#050508",
    text: "#ffffff",
    heroGradient: (primary) => eclatHeroGradient(primary),
  },
  minimal: {
    surface: "#f7f7f5",
    muted: "rgba(23,23,23,0.62)",
    card: "#ffffff",
    border: "rgba(23,23,23,0.08)",
    footer: "#111111",
    text: "#171717",
    heroGradient: () => "linear-gradient(135deg, #ffffff 0%, #f7f7f5 100%)",
  },
  atelier: {
    surface: "#f4efe6",
    muted: "rgba(28,25,23,0.62)",
    card: "#fffaf3",
    border: "rgba(28,25,23,0.08)",
    footer: "#1c1917",
    text: "#1c1917",
    heroGradient: () => "linear-gradient(135deg, #efe6d8 0%, #f4efe6 100%)",
  },
};

export function resolveLayout(layoutKey: string | null | undefined): LayoutKey {
  if (layoutKey === "minimal" || layoutKey === "atelier" || layoutKey === "nocturne" || layoutKey === "eclat") {
    return layoutKey;
  }
  return "eclat";
}

export function themeStyle(theme: SiteTheme): Record<string, string> {
  const layout = resolveLayout(theme.layoutKey);
  const tokens = LAYOUTS[layout];
  const primary = theme.primaryColor || (layout === "eclat" || layout === "nocturne" ? "#6b4c9a" : "#c4457a");
  // Éclat: corps toujours clair. Nocturne: corps toujours sombre (même structure).
  const background =
    layout === "eclat" || layout === "nocturne" ? tokens.surface : theme.backgroundColor || tokens.surface;
  const foreground = layout === "eclat" || layout === "nocturne" ? tokens.text : theme.textColor || tokens.text;
  const footer = theme.secondaryColor || tokens.footer;

  return {
    ["--site-bg" as string]: background,
    ["--site-fg" as string]: foreground,
    ["--site-primary" as string]: primary,
    ["--site-secondary" as string]: footer,
    ["--site-muted" as string]: tokens.muted,
    ["--site-card" as string]: tokens.card,
    ["--site-border" as string]: tokens.border,
    ["--site-hero" as string]: tokens.heroGradient(primary),
    ["--site-hero-fg" as string]: layout === "eclat" || layout === "nocturne" ? "#ffffff" : foreground,
    ["--site-hero-muted" as string]:
      layout === "eclat" || layout === "nocturne" ? "rgba(255,255,255,0.72)" : tokens.muted,
    background,
    color: foreground,
  };
}

export function isLightLayout(layoutKey: string | null | undefined) {
  const layout = resolveLayout(layoutKey);
  return layout === "minimal" || layout === "atelier" || layout === "eclat";
}

/** Hero / auth panels with light text (Éclat, Nocturne). */
export function isDarkHeroLayout(layoutKey: string | null | undefined) {
  const layout = resolveLayout(layoutKey);
  return layout === "eclat" || layout === "nocturne";
}

/** Mix a hex color toward black (amount 0 = unchanged, 1 = black). */
export function shadeTowardBlack(hex: string, amount: number) {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex;
  const n = Math.min(1, Math.max(0, amount));
  const channel = (start: number) =>
    Math.round(parseInt(full.slice(start, start + 2), 16) * (1 - n))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Éclat hero: couleur choisie → même teinte beaucoup plus sombre. */
export function eclatHeroGradient(primary: string) {
  return `linear-gradient(105deg, ${primary} 0%, ${shadeTowardBlack(primary, 0.55)} 48%, ${shadeTowardBlack(primary, 0.88)} 100%)`;
}

export function formatPriceXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

const FALLBACK_IMAGES: Record<string, string> = {
  "robe wax adjoa": "/landing/robe-wax.jpg",
  "sac en raphia": "/landing/sac-raphia.jpg",
  "sandales cuir tressé": "/landing/beurre-karite.jpg",
  "boucles perles de verre": "/landing/maison-awa.jpg",
  "chemise bogolan": "/landing/eclat-feuilles.jpg",
  "foulard soie imprimé": "/landing/minimal-palette.jpg",
  "pagne tissé kente": "/landing/atelier-dessert.jpg",
  "beurre de karité 250 g": "/landing/beurre-karite.jpg",
};

export function productImage(name: string, photos: Array<{ url: string }>) {
  if (photos[0]?.url) return photos[0].url;
  return FALLBACK_IMAGES[name.trim().toLowerCase()] || "/landing/boutique-hero.jpg";
}
