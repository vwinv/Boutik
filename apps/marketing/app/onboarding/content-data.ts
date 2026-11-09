export type ContentItem = {
  id: string;
  name: string;
  priceXof: number;
  tag: string;
  image: string | null;
};

export type ContentDraft = {
  items: ContentItem[];
};

export const emptyContent: ContentDraft = { items: [] };

export const DEMO_PRODUCTS: Omit<ContentItem, "id">[] = [
  { name: "Robe wax Adjoa", priceXof: 25000, tag: "Mode · Prêt-à-porter", image: "/landing/robe-wax.jpg" },
  { name: "Sac en raphia", priceXof: 15000, tag: "Accessoires", image: "/landing/sac-raphia.jpg" },
  { name: "Sandales cuir tressé", priceXof: 15000, tag: "Chaussures", image: "/landing/beurre-karite.jpg" },
  { name: "Boucles perles de verre", priceXof: 6500, tag: "Bijoux", image: "/landing/maison-awa.jpg" },
  { name: "Chemise bogolan", priceXof: 22000, tag: "Mode · Prêt-à-porter", image: "/landing/eclat-feuilles.jpg" },
  { name: "Foulard soie imprimé", priceXof: 9000, tag: "Accessoires", image: "/landing/minimal-palette.jpg" },
  { name: "Pagne tissé Kente", priceXof: 27000, tag: "Tissus", image: "/landing/atelier-dessert.jpg" },
  { name: "Beurre de karité 250 g", priceXof: 4500, tag: "Soins", image: "/landing/beurre-karite.jpg" },
];

export const DEMO_DISHES: Omit<ContentItem, "id">[] = [
  { name: "Thieboudienne", priceXof: 3500, tag: "Plats", image: "/landing/baobab-plat.jpg" },
  { name: "Yassa poulet", priceXof: 4000, tag: "Plats", image: "/landing/nocturne-plat.jpg" },
  { name: "Allocos", priceXof: 1500, tag: "Accompagnements", image: "/landing/baobab-alloco.jpg" },
  { name: "Bissap", priceXof: 1000, tag: "Boissons", image: "/landing/baobab-bissap.jpg" },
];

export const DEMO_SERVICES: Omit<ContentItem, "id">[] = [
  { name: "Consultation", priceXof: 15000, tag: "Services", image: null },
  { name: "Création sur mesure", priceXof: 45000, tag: "Services", image: null },
  { name: "Atelier découverte", priceXof: 8000, tag: "Ateliers", image: null },
];

export function contentCopy(category: "BOUTIQUE" | "RESTAURANT" | "VITRINE") {
  if (category === "RESTAURANT") {
    return {
      title: "Ajoutez vos premiers plats",
      subtitle: "Ajoutez au moins un plat pour continuer. Vous pourrez enrichir le menu ensuite.",
      nameLabel: "Nom du plat",
      priceLabel: "Prix (FCFA)",
      photoLabel: "Photo",
      addLabel: "+ Ajouter",
      emptyError: "Ajoutez au moins un plat.",
      defaultTag: "Plats",
      demo: DEMO_DISHES,
    };
  }
  if (category === "VITRINE") {
    return {
      title: "Ajoutez vos premiers services",
      subtitle: "Ajoutez au moins un service pour continuer. Vous pourrez les modifier ensuite.",
      nameLabel: "Nom du service",
      priceLabel: "Prix (FCFA)",
      photoLabel: "Photo",
      addLabel: "+ Ajouter",
      emptyError: "Ajoutez au moins un service.",
      defaultTag: "Services",
      demo: DEMO_SERVICES,
    };
  }
  return {
    title: "Ajoutez vos premiers produits",
    subtitle: "Ajoutez au moins un produit pour continuer. Vous pourrez enrichir le catalogue ensuite.",
    nameLabel: "Nom du produit",
    priceLabel: "Prix (FCFA)",
    photoLabel: "Photo",
    addLabel: "+ Ajouter",
    emptyError: "Ajoutez au moins un produit.",
    defaultTag: "Produits",
    demo: DEMO_PRODUCTS,
  };
}

export function validateContentImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "La photo doit être un JPG, PNG ou WebP.";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "La photo dépasse 5 Mo.";
  }
  return null;
}

/** Compress a local image for onboarding drafts (data URL). */
export async function readContentImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Impossible de préparer la photo.");
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de lire la photo."));
    image.src = src;
  });
}

export function formatPriceXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export function parsePriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function newContentId() {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
