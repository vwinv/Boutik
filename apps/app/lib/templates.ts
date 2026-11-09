export type LayoutKey = "eclat" | "minimal" | "atelier" | "nocturne";

export const LAYOUTS: {
  id: LayoutKey;
  name: string;
  badge: "Gratuit" | "Premium";
  swatch: string;
  previewBg: string;
  previewFg: string;
  blurb: string;
}[] = [
  {
    id: "eclat",
    name: "Éclat",
    badge: "Gratuit",
    swatch: "#6b4c9a",
    previewBg: "#ffffff",
    previewFg: "#171717",
    blurb: "Grande bannière et typographie affirmée.",
  },
  {
    id: "minimal",
    name: "Minimal",
    badge: "Gratuit",
    swatch: "#f5f5f5",
    previewBg: "#ffffff",
    previewFg: "#171717",
    blurb: "Mise en page claire, centrée sur le produit.",
  },
  {
    id: "atelier",
    name: "Atelier",
    badge: "Premium",
    swatch: "#e8dcc8",
    previewBg: "#f4efe6",
    previewFg: "#1c1917",
    blurb: "Ambiance artisanale et grandes photos.",
  },
  {
    id: "nocturne",
    name: "Nocturne",
    badge: "Premium",
    swatch: "#0f0f12",
    previewBg: "#0b0b0f",
    previewFg: "#f5f5f5",
    blurb: "Même structure qu’Éclat, en version sombre.",
  },
];

export const PRIMARY_COLORS = ["#111111", "#5c5c5c", "#d35400", "#1f8a5b", "#6b4c9a", "#c4457a"] as const;
export const SECONDARY_COLORS = ["#111111", "#1a2a4a", "#5c4033", "#2d4a3e"] as const;

export const PREVIEW_PRODUCTS = [
  { name: "Robe wax Adjoa", price: "25 000 FCFA" },
  { name: "Sac en raphia", price: "15 000 FCFA" },
  { name: "Sandales cuir tressé", price: "15 000 FCFA" },
  { name: "Boucles perles de verre", price: "6 500 FCFA" },
] as const;

export function resolveLayoutKey(value: string | null | undefined): LayoutKey {
  if (value === "minimal" || value === "atelier" || value === "nocturne" || value === "eclat") return value;
  return "eclat";
}

export function layoutName(id: LayoutKey) {
  return LAYOUTS.find((item) => item.id === id)?.name ?? id;
}

function shadeTowardBlack(hex: string, amount: number) {
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

export function eclatHeroGradient(primary: string) {
  return `linear-gradient(105deg, ${primary} 0%, ${shadeTowardBlack(primary, 0.55)} 48%, ${shadeTowardBlack(primary, 0.88)} 100%)`;
}

export function layoutHeroBackground(id: LayoutKey, primary: string) {
  if (id === "eclat" || id === "nocturne") return eclatHeroGradient(primary);
  if (id === "atelier") return "#f4efe6";
  return "#ffffff";
}
