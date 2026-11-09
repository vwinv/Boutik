export type TemplateId = "eclat" | "minimal" | "atelier" | "nocturne";

export type TemplateDraft = {
  templateId: TemplateId;
  primary: string;
  secondary: string;
  applied: boolean;
};

export const emptyTemplate: TemplateDraft = {
  templateId: "eclat",
  primary: "#6b4c9a",
  secondary: "#111111",
  applied: false,
};

export const TEMPLATES: {
  id: TemplateId;
  name: string;
  badge: "Gratuit" | "Premium";
  swatch: string;
  previewBg: string;
  previewFg: string;
}[] = [
  { id: "eclat", name: "Éclat", badge: "Gratuit", swatch: "#6b4c9a", previewBg: "#ffffff", previewFg: "#171717" },
  { id: "minimal", name: "Minimal", badge: "Gratuit", swatch: "#f5f5f5", previewBg: "#ffffff", previewFg: "#171717" },
  { id: "atelier", name: "Atelier", badge: "Premium", swatch: "#e8dcc8", previewBg: "#f4efe6", previewFg: "#1c1917" },
  { id: "nocturne", name: "Nocturne", badge: "Premium", swatch: "#0f0f12", previewBg: "#0b0b0f", previewFg: "#f5f5f5" },
];

export const PRIMARY_COLORS = ["#111111", "#5c5c5c", "#d35400", "#1f8a5b", "#6b4c9a", "#c4457a"] as const;
export const SECONDARY_COLORS = ["#111111", "#1a2a4a", "#5c4033", "#2d4a3e"] as const;

export const PREVIEW_PRODUCTS = [
  { name: "Robe wax Adjoa", price: "25 000 FCFA", image: "/landing/robe-wax.jpg" },
  { name: "Sac en raphia", price: "15 000 FCFA", image: "/landing/sac-raphia.jpg" },
  { name: "Sandales cuir tressé", price: "15 000 FCFA", image: "/landing/beurre-karite.jpg" },
  { name: "Boucles perles de verre", price: "6 500 FCFA", image: "/landing/maison-awa.jpg" },
] as const;

export function templateName(id: TemplateId) {
  return TEMPLATES.find((item) => item.id === id)?.name ?? id;
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
