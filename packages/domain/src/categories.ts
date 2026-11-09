import { CAPABILITIES, type Capability, type Category } from "./types";

export const CATEGORIES: Category[] = ["VITRINE", "RESTAURANT", "BOUTIQUE"];

export const CORE_CAPABILITIES: Capability[] = ["pages", "gallery", "contact", "seo", "theme"];

export const CATEGORY_CAPABILITIES: Record<Category, Capability[]> = {
  VITRINE: [...CORE_CAPABILITIES, "hours", "reservations"],
  RESTAURANT: [...CORE_CAPABILITIES, "menu", "hours", "reservations", "click_collect", "wallet", "customers"],
  BOUTIQUE: [...CORE_CAPABILITIES, "catalog", "cart", "checkout", "stock", "orders", "wallet", "customers"],
};

export const CATEGORY_LABELS: Record<Category, string> = {
  VITRINE: "Site vitrine",
  RESTAURANT: "Restaurant",
  BOUTIQUE: "E-commerce",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  VITRINE: "Présentez votre activité, vos réalisations et vos coordonnées.",
  RESTAURANT: "Menu, horaires, réservations et commande à emporter.",
  BOUTIQUE: "Catalogue, panier, paiement et suivi des commandes.",
};

export function capabilitiesFor(category: Category): Capability[] {
  return CATEGORY_CAPABILITIES[category];
}

export function hasCapability(category: Category, capability: Capability) {
  return CATEGORY_CAPABILITIES[category].includes(capability);
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as string[]).includes(value);
}

export function uniqueCapabilities(...lists: Capability[][]): Capability[] {
  const seen = new Set<Capability>();
  for (const list of lists) {
    for (const item of list) {
      seen.add(item);
    }
  }
  return CAPABILITIES.filter((item) => seen.has(item));
}

export function intersectCapabilities(category: Category, granted: Capability[]): Capability[] {
  const allowed = new Set(CATEGORY_CAPABILITIES[category]);
  return granted.filter((item) => allowed.has(item));
}

export function effectiveCapabilities(category: Category, granted: Capability[]): Capability[] {
  return intersectCapabilities(category, uniqueCapabilities(granted));
}
