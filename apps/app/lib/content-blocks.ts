export type BlockKey =
  | "hero"
  | "featured"
  | "promotions"
  | "about"
  | "reviews"
  | "gallery"
  | "newsletter"
  | "faq";

export type BlockPreset = {
  key: BlockKey;
  title: string;
  description: string;
  type: "HERO" | "TEXT" | "BANNER" | "GALLERY" | "CTA" | "CONTACT";
  mandatory?: boolean;
  addable?: boolean;
};

/** Toujours présents / créés automatiquement. */
export const CORE_BLOCKS: BlockPreset[] = [
  {
    key: "hero",
    title: "Accueil",
    description: "Bannière et message d’accueil",
    type: "HERO",
    mandatory: true,
  },
];

/** Anciens blocs retirés de Pages & contenus — à supprimer s’ils existent encore. */
export const REMOVED_BLOCK_KEYS = ["catalog", "categories", "gallery", "faq", "newsletter"] as const;

/** Proposés dans le menu + Ajouter (ordre d’affichage). */
export const ADDABLE_BLOCKS: BlockPreset[] = [
  {
    key: "about",
    title: "À propos",
    description: "Section À propos du site public",
    type: "TEXT",
    addable: true,
  },
  {
    key: "promotions",
    title: "Promotions",
    description: "Section promotions du site public (après le catalogue)",
    type: "BANNER",
    addable: true,
  },
  {
    key: "featured",
    title: "Produits mis en avant",
    description: "Section produits mis en avant du site public",
    type: "BANNER",
    addable: true,
  },
  {
    key: "reviews",
    title: "Avis clients",
    description: "Notes et avis clients sur les pages produit",
    type: "TEXT",
    addable: true,
  },
];

const BLOCK_PREFIX = "@boutik-block:";

export function blockMarker(key: BlockKey) {
  return `${BLOCK_PREFIX}${key}`;
}

export function parseBlockKey(body: string | null | undefined, type?: string | null): BlockKey | null {
  if (body) {
    const match = body.match(/^@boutik-block:([a-z-]+)/m);
    const raw = match?.[1];
    if (!raw) return null;
    if ((REMOVED_BLOCK_KEYS as readonly string[]).includes(raw)) return null;
    if (CORE_BLOCKS.some((item) => item.key === raw) || ADDABLE_BLOCKS.some((item) => item.key === raw)) {
      return raw as BlockKey;
    }
  }
  if (type === "HERO") return "hero";
  if (type === "CONTACT") return null;
  return null;
}

export function isRemovedBlock(body: string | null | undefined, title?: string | null) {
  if (body) {
    const match = body.match(/^@boutik-block:([a-z-]+)/m);
    if (match?.[1] && (REMOVED_BLOCK_KEYS as readonly string[]).includes(match[1])) return true;
  }
  const label = (title || "").trim().toLowerCase();
  return (
    label === "catalogue" ||
    label === "catégories" ||
    label === "categories" ||
    label === "galerie" ||
    label === "faq" ||
    label === "newsletter"
  );
}

export function stripBlockMarker(body: string | null | undefined) {
  if (!body) return "";
  return body.replace(/^@boutik-block:[a-z-]+\n?/, "").trim();
}

export function withBlockMarker(key: BlockKey, body: string | null | undefined) {
  const content = stripBlockMarker(body);
  return content ? `${blockMarker(key)}\n${content}` : blockMarker(key);
}

export function presetForKey(key: BlockKey) {
  return [...CORE_BLOCKS, ...ADDABLE_BLOCKS].find((item) => item.key === key) ?? null;
}
