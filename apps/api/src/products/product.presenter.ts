import type { Product, ProductCategory, ProductPhoto, ProductVariant } from "@prisma/client";

export const productInclude = {
  category: true,
  variants: { orderBy: { sortOrder: "asc" as const } },
  photos: { orderBy: { sortOrder: "asc" as const } },
} as const;

export type ProductRecord = Product & {
  category: ProductCategory | null;
  variants: ProductVariant[];
  photos: ProductPhoto[];
};

export function presentCategory(category: ProductCategory) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export type VariantOption = { kind: string; value: string };

export function normalizeVariantOptions(variant: ProductVariant): VariantOption[] {
  const raw = variant.options;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { kind?: unknown; value?: unknown };
        const kind = typeof row.kind === "string" ? row.kind.trim() : "";
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!kind || !value) return null;
        return { kind, value };
      })
      .filter((item): item is VariantOption => Boolean(item));
  }
  const legacy: VariantOption[] = [];
  if (variant.option1Kind && variant.option1Value) {
    legacy.push({ kind: variant.option1Kind, value: variant.option1Value });
  }
  if (variant.option2Kind && variant.option2Value) {
    legacy.push({ kind: variant.option2Kind, value: variant.option2Value });
  }
  return legacy;
}

export function presentVariant(variant: ProductVariant) {
  const options = normalizeVariantOptions(variant);
  return {
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    priceXof: variant.priceXof,
    availability: variant.availability,
    stockQty: variant.stockQty,
    lowStockThreshold: variant.lowStockThreshold,
    option1Kind: options[0]?.kind ?? variant.option1Kind,
    option1Value: options[0]?.value ?? variant.option1Value,
    option2Kind: options[1]?.kind ?? variant.option2Kind,
    option2Value: options[1]?.value ?? variant.option2Value,
    options,
    isActive: variant.isActive,
    sortOrder: variant.sortOrder,
  };
}

export function presentPhoto(photo: ProductPhoto, fileUrl: string) {
  return {
    id: photo.id,
    alt: photo.alt,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    optionKind: photo.optionKind,
    optionValue: photo.optionValue,
    sortOrder: photo.sortOrder,
    url: fileUrl,
  };
}

export function presentProduct(
  product: ProductRecord,
  options: { currency: string; photoUrl: (photo: ProductPhoto) => string; publicOnly?: boolean },
) {
  const variants = options.publicOnly ? product.variants.filter((item) => item.isActive) : product.variants;
  const photos = product.photos.map((photo) => presentPhoto(photo, options.photoUrl(photo)));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceXof: product.priceXof,
    compareAtPriceXof: product.compareAtPriceXof,
    currency: options.currency,
    availability: product.availability,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    isPublished: product.isPublished,
    sortOrder: product.sortOrder,
    category: product.category ? presentCategory(product.category) : null,
    variants: variants.map(presentVariant),
    photos,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function presentPublicProduct(
  product: ProductRecord,
  options: { currency: string; photoUrl: (photo: ProductPhoto) => string },
) {
  const presented = presentProduct(product, { ...options, publicOnly: true });
  return {
    slug: presented.slug,
    name: presented.name,
    description: presented.description,
    priceXof: presented.priceXof,
    compareAtPriceXof: presented.compareAtPriceXof,
    currency: presented.currency,
    availability: presented.availability,
    isFeatured: presented.isFeatured,
    sortOrder: presented.sortOrder,
    category: presented.category
      ? { slug: presented.category.slug, name: presented.category.name }
      : null,
    variants: presented.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceXof: variant.priceXof,
      availability: variant.availability ?? (variant.stockQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK"),
      stockQty: variant.stockQty,
      option1Kind: variant.option1Kind,
      option1Value: variant.option1Value,
      option2Kind: variant.option2Kind,
      option2Value: variant.option2Value,
      options: variant.options,
      sortOrder: variant.sortOrder,
    })),
    photos: presented.photos.map((photo) => ({
      id: photo.id,
      alt: photo.alt,
      url: photo.url,
      optionKind: photo.optionKind,
      optionValue: photo.optionValue,
      sortOrder: photo.sortOrder,
    })),
  };
}
