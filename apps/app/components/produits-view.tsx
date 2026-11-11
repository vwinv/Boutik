"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { proApi, proUpload } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, readProSession } from "../lib/auth";
import { AuthImage } from "./auth-image";
import { ProShell } from "./pro-shell";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type ProductVariant = {
  id: string;
  name: string;
  stockQty: number | null;
  lowStockThreshold?: number | null;
  isActive: boolean;
  option1Kind?: string | null;
  option1Value?: string | null;
  option2Kind?: string | null;
  option2Value?: string | null;
  options?: Array<{ kind: string; value: string }>;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceXof: number;
  compareAtPriceXof: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
  stockQty: number | null;
  lowStockThreshold: number | null;
  isFeatured: boolean;
  isActive: boolean;
  isPublished: boolean;
  sortOrder: number;
  category: Category | null;
  variants?: ProductVariant[];
  photos: Array<{
    id: string;
    url: string;
    alt: string | null;
    optionKind?: string | null;
    optionValue?: string | null;
  }>;
};

type VariantKind = "Couleur" | "Taille" | "Pointure";

type VariantAxisDraft = {
  kind: VariantKind;
  values: string[];
};

type SkuDraft = {
  key: string;
  variantId?: string;
  options: Array<{ kind: VariantKind; value: string }>;
  stockQty: string;
  lowStockThreshold: string;
  enabled: boolean;
};

type ColorPhotoDraft = {
  file: File;
  name: string;
};

type ExistingColorDraft = {
  key: string;
  photoId: string | null;
  originalName: string;
  name: string;
  previewUrl: string | null;
  newFile: File | null;
  removed: boolean;
};

type ProductFormValues = {
  name: string;
  priceXof: number;
  categoryId: string;
  description: string;
  stockQty: string;
  lowStockThreshold: string;
  isFeatured: boolean;
  isPromo: boolean;
  promoMode: "amount" | "percent";
  promoValue: string;
  photos: File[];
  colorPhotos: ColorPhotoDraft[];
  existingColors: ExistingColorDraft[];
  removedVariantIds: string[];
  skus: SkuDraft[];
};

const VARIANT_KINDS: VariantKind[] = ["Couleur", "Taille", "Pointure"];
const MAX_PHOTOS = 4;
const MAX_COLOR_PHOTOS = 8;

function couleurFallback(index: number) {
  return `Couleur ${index + 1}`;
}

function couleurName(draft: ColorPhotoDraft, index: number) {
  const trimmed = draft.name.trim();
  return trimmed || couleurFallback(index);
}

function uniqueCouleurNames(drafts: ColorPhotoDraft[]) {
  const used = new Map<string, number>();
  return drafts.map((draft, index) => {
    const base = couleurName(draft, index);
    const key = base.toLowerCase();
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

type FilterKey = "tous" | "actif" | "faible" | "rupture" | "archive";

export function ProduitsPage() {
  return (
    <ProShell title="Produits">
      <ProduitsBody />
    </ProShell>
  );
}

function ProduitsBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [query, setQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [productForm, setProductForm] = useState<"create" | Product | null>(null);
  const [promoProduct, setPromoProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe(session.accessToken);
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      setTenantId(active.tenantId);
      const [productList, categoryList] = await Promise.all([
        proApi<Product[]>(`/api/workspaces/${active.tenantId}/products`),
        proApi<Category[]>(`/api/workspaces/${active.tenantId}/product-categories`),
      ]);
      setProducts(productList);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (filter === "actif" && !(product.isActive && product.availability !== "OUT_OF_STOCK")) return false;
      if (filter === "faible" && !isLowStock(product)) return false;
      if (filter === "rupture" && !hasOutOfStock(product)) return false;
      if (filter === "archive" && product.isActive) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle) ||
        (product.category?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [products, filter, query]);

  async function createCategory(values: { name: string; description: string }): Promise<boolean> {
    if (!tenantId) return false;
    setBusy(true);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/product-categories`, {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim() || null,
        }),
      });
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création de catégorie impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: Category) {
    if (!tenantId || !window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;
    setBusy(true);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/product-categories/${category.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression de catégorie impossible.");
    } finally {
      setBusy(false);
    }
  }

  function pricingFromForm(values: ProductFormValues) {
    const basePrice = values.priceXof;
    let priceXof = basePrice;
    let compareAtPriceXof: number | null = null;
    if (values.isPromo) {
      const promoValue = Number(values.promoValue) || 0;
      const discount =
        values.promoMode === "percent" ? Math.round((basePrice * promoValue) / 100) : Math.round(promoValue);
      priceXof = Math.max(0, basePrice - discount);
      if (priceXof >= basePrice) throw new Error("La promotion doit baisser le prix.");
      compareAtPriceXof = basePrice;
    }
    return { priceXof, compareAtPriceXof };
  }

  async function createProduct(values: ProductFormValues) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const { priceXof, compareAtPriceXof } = pricingFromForm(values);
      const hasSkus = values.skus.some((item) => item.enabled);
      const stockQty = hasSkus
        ? null
        : values.stockQty.trim() === ""
          ? null
          : Number(values.stockQty);
      const lowStockThreshold = hasSkus
        ? null
        : values.lowStockThreshold.trim() === ""
          ? null
          : Number(values.lowStockThreshold);
      const created = await proApi<Product>(`/api/workspaces/${tenantId}/products`, {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim() || null,
          priceXof,
          compareAtPriceXof,
          categoryId: values.categoryId || null,
          stockQty,
          lowStockThreshold,
          isFeatured: values.isFeatured,
          isActive: true,
          isPublished: true,
          availability: stockQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
        }),
      });
      setProductForm(null);
      try {
        if (values.colorPhotos.length > 0) {
          const colorNames = uniqueCouleurNames(values.colorPhotos.slice(0, MAX_COLOR_PHOTOS));
          for (const [index, draft] of values.colorPhotos.slice(0, MAX_COLOR_PHOTOS).entries()) {
            const form = new FormData();
            form.append("file", draft.file);
            form.append("optionKind", "Couleur");
            form.append("optionValue", colorNames[index] ?? couleurFallback(index));
            await proUpload(`/api/workspaces/${tenantId}/products/${created.id}/photos`, form);
          }
        } else {
          for (const file of values.photos.slice(0, MAX_PHOTOS)) {
            const form = new FormData();
            form.append("file", file);
            await proUpload(`/api/workspaces/${tenantId}/products/${created.id}/photos`, form);
          }
        }
        let sortOrder = 0;
        for (const sku of values.skus.filter((item) => item.enabled)) {
          const stock = sku.stockQty.trim() === "" ? null : Number(sku.stockQty);
          const lowStockThreshold = sku.lowStockThreshold.trim() === "" ? null : Number(sku.lowStockThreshold);
          const name = sku.options.map((option) => option.value).join(" / ");
          await proApi(`/api/workspaces/${tenantId}/products/${created.id}/variants`, {
            method: "POST",
            body: JSON.stringify({
              name,
              sortOrder,
              stockQty: stock,
              lowStockThreshold,
              availability: stock === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
              option1Kind: sku.options[0]?.kind ?? null,
              option1Value: sku.options[0]?.value ?? null,
              option2Kind: sku.options[1]?.kind ?? null,
              option2Value: sku.options[1]?.value ?? null,
              options: sku.options,
            }),
          });
          sortOrder += 1;
        }
      } finally {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création du produit impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function updateProduct(product: Product, values: ProductFormValues) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const { priceXof, compareAtPriceXof } = pricingFromForm(values);
      const hasVariantSkus = (product.variants?.length ?? 0) > 0;
      const stockQty = hasVariantSkus
        ? null
        : values.stockQty.trim() === ""
          ? null
          : Number(values.stockQty);
      const lowStockThreshold = hasVariantSkus
        ? null
        : values.lowStockThreshold.trim() === ""
          ? null
          : Number(values.lowStockThreshold);
      await proApi(`/api/workspaces/${tenantId}/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim() || null,
          priceXof,
          compareAtPriceXof: values.isPromo ? compareAtPriceXof : null,
          categoryId: values.categoryId || null,
          stockQty,
          lowStockThreshold,
          isFeatured: values.isFeatured,
          availability: stockQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
        }),
      });

      const base = `/api/workspaces/${tenantId}/products/${product.id}`;
      const deletedVariantIds = new Set<string>();

      for (const variantId of values.removedVariantIds) {
        await proApi(`${base}/variants/${variantId}`, { method: "DELETE" });
        deletedVariantIds.add(variantId);
      }

      for (const color of values.existingColors.filter((item) => item.removed)) {
        for (const variant of product.variants ?? []) {
          if (deletedVariantIds.has(variant.id)) continue;
          if (!variantHasCouleur(variant, color.originalName)) continue;
          await proApi(`${base}/variants/${variant.id}`, { method: "DELETE" });
          deletedVariantIds.add(variant.id);
        }
        if (color.photoId) {
          await proApi(`${base}/photos/${color.photoId}`, { method: "DELETE" });
        }
      }

      for (const color of values.existingColors.filter((item) => !item.removed)) {
        const nextName = color.name.trim() || color.originalName;
        const renamed = nextName !== color.originalName;

        if (color.newFile) {
          if (color.photoId) {
            await proApi(`${base}/photos/${color.photoId}`, { method: "DELETE" });
          }
          const form = new FormData();
          form.append("file", color.newFile);
          form.append("optionKind", "Couleur");
          form.append("optionValue", nextName);
          await proUpload(`${base}/photos`, form);
        } else if (renamed && color.photoId) {
          await proApi(`${base}/photos/${color.photoId}`, {
            method: "PATCH",
            body: JSON.stringify({ optionKind: "Couleur", optionValue: nextName }),
          });
        }

        if (renamed) {
          for (const variant of product.variants ?? []) {
            if (deletedVariantIds.has(variant.id)) continue;
            if (!variantHasCouleur(variant, color.originalName)) continue;
            const options = variantOptions(variant).map((option) =>
              option.kind === "Couleur" && option.value === color.originalName
                ? { ...option, value: nextName }
                : option,
            );
            await proApi(`${base}/variants/${variant.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: options.map((option) => option.value).join(" / "),
                options,
                option1Kind: options[0]?.kind ?? null,
                option1Value: options[0]?.value ?? null,
                option2Kind: options[1]?.kind ?? null,
                option2Value: options[1]?.value ?? null,
              }),
            });
          }
        }
      }

      for (const sku of values.skus) {
        if (!sku.variantId || deletedVariantIds.has(sku.variantId)) continue;
        const stock = sku.stockQty.trim() === "" ? null : Number(sku.stockQty);
        const skuLow = sku.lowStockThreshold.trim() === "" ? null : Number(sku.lowStockThreshold);
        await proApi(`${base}/variants/${sku.variantId}`, {
          method: "PATCH",
          body: JSON.stringify({
            stockQty: stock,
            lowStockThreshold: skuLow,
            isActive: sku.enabled,
            availability: !sku.enabled || stock === 0 ? "OUT_OF_STOCK" : "IN_STOCK",
          }),
        });
      }
      setProductForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification du produit impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveProduct(product: Product) {
    if (!tenantId) return;
    setBusy(true);
    try {
      await proApi(`/api/workspaces/${tenantId}/products/${product.id}/deactivate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archivage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!tenantId || !window.confirm(`Supprimer « ${product.name} » ?`)) return;
    setBusy(true);
    try {
      await proApi(`/api/workspaces/${tenantId}/products/${product.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function applyPromo(product: Product, values: { mode: "amount" | "percent"; value: number }) {
    if (!tenantId) return;
    const base =
      product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof
        ? product.compareAtPriceXof
        : product.priceXof;
    const discount =
      values.mode === "percent" ? Math.round((base * values.value) / 100) : Math.round(values.value);
    const nextPrice = Math.max(0, base - discount);
    if (nextPrice >= base) {
      setError("La réduction doit baisser le prix du produit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priceXof: nextPrice,
          compareAtPriceXof: base,
        }),
      });
      setPromoProduct(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise en promo impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-[420px] animate-pulse rounded-[24px] bg-white" />;
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-[24px] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tous", "Tous"],
                ["actif", "Actif"],
                ["faible", "Stock faible"],
                ["rupture", "Rupture"],
                ["archive", "Archivé"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  filter === key ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1 sm:w-56">
              <span className="sr-only">Rechercher</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pr-4 pl-9 text-sm outline-none focus:border-neutral-400"
              />
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-400">⌕</span>
            </label>
            <button
              type="button"
              onClick={() => setCategoryOpen(true)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              + Ajouter une catégorie
            </button>
            <button
              type="button"
              onClick={() => setProductForm("create")}
              className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
            >
              + Ajouter un produit
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] tracking-[0.12em] text-neutral-400 uppercase">
                <th className="px-2 py-3 font-medium">Produits</th>
                <th className="px-2 py-3 font-medium">Catégorie</th>
                <th className="px-2 py-3 font-medium">Prix</th>
                <th className="px-2 py-3 font-medium">Stock / Dispo.</th>
                <th className="px-2 py-3 font-medium">Statut</th>
                <th className="px-2 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const status = statusFor(product);
                const photo = product.photos[0]?.url;
                const highlightVariants =
                  filter === "faible"
                    ? lowStockVariants(product)
                    : filter === "rupture"
                      ? outOfStockVariants(product)
                      : [];
                return (
                  <Fragment key={product.id}>
                    <tr className="border-b border-neutral-50">
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-12 overflow-hidden rounded-xl bg-neutral-100">
                            <AuthImage
                              src={photo}
                              className="size-full object-cover"
                              fallback={
                                <div className="grid size-full place-items-center text-[10px] text-neutral-400">IMG</div>
                              }
                            />
                          </div>
                          <div>
                            <p className="font-medium tracking-tight">{product.name}</p>
                            <p className="text-xs text-neutral-400">
                              REF-{String(product.sortOrder + 101).padStart(3, "0")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-neutral-600">{product.category?.name || "—"}</td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{formatXof(product.priceXof)}</p>
                        {product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof ? (
                          <p className="text-xs text-neutral-400 line-through">{formatXof(product.compareAtPriceXof)}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-neutral-600">{stockLabel(product)}</td>
                      <td className="px-2 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setProductForm(product)}
                            className={actionBtnClass}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPromoProduct(product)}
                            className={actionBtnClass}
                          >
                            Mettre en promo
                          </button>
                          <button
                            type="button"
                            disabled={busy || !product.isActive}
                            onClick={() => void archiveProduct(product)}
                            className={actionBtnClass}
                          >
                            Archiver
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeProduct(product)}
                            className={`${actionBtnClass} text-red-600`}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                    {highlightVariants.map((variant) => {
                      const variantStatus =
                        filter === "rupture" || variant.stockQty === 0
                          ? { label: "Rupture", className: "bg-red-100 text-red-700" }
                          : { label: "Stock faible", className: "bg-amber-100 text-amber-800" };
                      return (
                        <tr key={`${product.id}-${variant.id}`} className="border-b border-neutral-50 bg-neutral-50/70">
                          <td className="px-2 py-2.5 pl-10" colSpan={2}>
                            <p className="text-sm text-neutral-700">
                              <span className="text-neutral-400">↳ </span>
                              {variant.name}
                            </p>
                          </td>
                          <td className="px-2 py-2.5 text-neutral-400">—</td>
                          <td className="px-2 py-2.5 text-sm text-neutral-700">
                            {variant.stockQty ?? 0}
                            {variant.lowStockThreshold != null ? (
                              <span className="text-neutral-400"> / alerte {variant.lowStockThreshold}</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${variantStatus.className}`}>
                              {variantStatus.label}
                            </span>
                          </td>
                          <td className="px-2 py-2.5" />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-neutral-500">
                    Aucun produit pour ce filtre.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {categoryOpen ? (
        <CategoryModal
          busy={busy}
          categories={categories}
          onClose={() => setCategoryOpen(false)}
          onSave={async (values) => createCategory(values)}
          onDelete={(category) => void removeCategory(category)}
        />
      ) : null}
      {productForm ? (
        <ProductModal
          key={productForm === "create" ? "create" : productForm.id}
          busy={busy}
          categories={categories}
          product={productForm === "create" ? null : productForm}
          onClose={() => setProductForm(null)}
          onSave={(values) => {
            if (productForm === "create") void createProduct(values);
            else void updateProduct(productForm, values);
          }}
        />
      ) : null}
      {promoProduct ? (
        <PromoModal
          product={promoProduct}
          busy={busy}
          onClose={() => setPromoProduct(null)}
          onSave={(values) => void applyPromo(promoProduct, values)}
        />
      ) : null}
    </>
  );
}

function CategoryModal({
  busy,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  busy: boolean;
  categories: Category[];
  onClose: () => void;
  onSave: (values: { name: string; description: string }) => Promise<boolean>;
  onDelete: (category: Category) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    const ok = await onSave({ name, description });
    if (!ok) return;
    setName("");
    setDescription("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Ajouter une catégorie</h3>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Nom</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Vêtements"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Description (optionnel)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold">
            Fermer
          </button>
          <button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() => void handleCreate()}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Créer
          </button>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-5">
          <p className="text-sm font-medium tracking-tight">
            Catégories existantes
            <span className="ml-1.5 font-normal text-neutral-400">({categories.length})</span>
          </p>
          {categories.length ? (
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          category.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {category.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{category.description}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-neutral-400">Aucune description</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(category)}
                    className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Aucune catégorie pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PromoModal({
  product,
  busy,
  onClose,
  onSave,
}: {
  product: Product;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { mode: "amount" | "percent"; value: number }) => void;
}) {
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [value, setValue] = useState("");
  const base =
    product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof
      ? product.compareAtPriceXof
      : product.priceXof;
  const numeric = Number(value) || 0;
  const discount = mode === "percent" ? Math.round((base * numeric) / 100) : Math.round(numeric);
  const nextPrice = Math.max(0, base - discount);
  const valid = numeric > 0 && nextPrice < base;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Mettre en promo</h3>
        <p className="mt-1 text-sm text-neutral-500">{product.name}</p>
        <p className="mt-3 text-sm">
          Prix actuel : <span className="font-semibold">{formatXof(base)}</span>
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("amount")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              mode === "amount" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Montant à déduire
          </button>
          <button
            type="button"
            onClick={() => setMode("percent")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              mode === "percent" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Pourcentage
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">{mode === "percent" ? "Réduction (%)" : "Montant déduit (FCFA)"}</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder={mode === "percent" ? "Ex. 20" : "Ex. 5000"}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        {numeric > 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Nouveau prix : <span className="font-semibold text-neutral-950">{formatXof(nextPrice)}</span>
            {base > nextPrice ? (
              <span className="text-neutral-400"> · avant {formatXof(base)}</span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => onSave({ mode, value: numeric })}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({
  busy,
  categories,
  product,
  onClose,
  onSave,
}: {
  busy: boolean;
  categories: Category[];
  product?: Product | null;
  onClose: () => void;
  onSave: (values: ProductFormValues) => void;
}) {
  const isEdit = Boolean(product);
  const initial = useMemo(() => initialProductForm(product ?? null, categories), [product, categories]);
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.price);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [description, setDescription] = useState(initial.description);
  const [stockQty, setStockQty] = useState(initial.stockQty);
  const [lowStockThreshold, setLowStockThreshold] = useState(initial.lowStockThreshold);
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured);
  const [isPromo, setIsPromo] = useState(initial.isPromo);
  const [promoMode, setPromoMode] = useState<"amount" | "percent">(initial.promoMode);
  const [promoValue, setPromoValue] = useState(initial.promoValue);
  const [hasVariants, setHasVariants] = useState(initial.hasVariants);
  const [axes, setAxes] = useState<VariantAxisDraft[]>(initial.axes);
  const [skus, setSkus] = useState<SkuDraft[]>(initial.skus);
  const [photos, setPhotos] = useState<File[]>([]);
  const [colorPhotos, setColorPhotos] = useState<ColorPhotoDraft[]>([]);
  const [existingColors, setExistingColors] = useState<ExistingColorDraft[]>(() =>
    product ? buildExistingColors(product) : [],
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  const hasCouleur = axes.some((axis) => axis.kind === "Couleur");
  const resolvedColorNames = useMemo(() => uniqueCouleurNames(colorPhotos), [colorPhotos]);
  const visibleExistingColors = useMemo(
    () => existingColors.filter((item) => !item.removed),
    [existingColors],
  );

  useEffect(() => {
    if (!hasVariants || isEdit) return;
    const values = resolvedColorNames;
    setAxes((current) => {
      const couleur = current.find((axis) => axis.kind === "Couleur");
      if (!couleur) return current;
      if (couleur.values.join("|") === values.join("|")) return current;
      return current.map((axis) => (axis.kind === "Couleur" ? { ...axis, values } : axis));
    });
  }, [resolvedColorNames, hasVariants, isEdit]);

  useEffect(() => {
    if (!hasVariants || isEdit) return;
    setSkus((current) => mergeSkuMatrix(buildSkuMatrix(axes), current));
  }, [axes, hasVariants, isEdit]);

  function toggleKind(kind: VariantKind) {
    setAxes((current) => {
      const exists = current.find((item) => item.kind === kind);
      if (exists) {
        if (kind === "Couleur") setColorPhotos([]);
        return current.filter((item) => item.kind !== kind);
      }
      return [
        ...current,
        { kind, values: kind === "Couleur" ? uniqueCouleurNames(colorPhotos) : [] },
      ];
    });
  }

  function addChip(kind: VariantKind, raw: string) {
    const value = raw.trim();
    if (!value || kind === "Couleur") return;
    setAxes((current) =>
      current.map((axis) =>
        axis.kind === kind && !axis.values.some((item) => item.toLowerCase() === value.toLowerCase())
          ? { ...axis, values: [...axis.values, value] }
          : axis,
      ),
    );
  }

  function removeChip(kind: VariantKind, value: string) {
    if (kind === "Couleur") return;
    setAxes((current) =>
      current.map((axis) =>
        axis.kind === kind ? { ...axis, values: axis.values.filter((item) => item !== value) } : axis,
      ),
    );
  }

  function updateSku(key: string, patch: Partial<Pick<SkuDraft, "stockQty" | "lowStockThreshold" | "enabled">>) {
    setSkus((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function renameExistingColor(key: string, name: string) {
    const target = existingColors.find((item) => item.key === key);
    if (!target) return;
    const previous = target.name.trim() || target.originalName;
    const nextLabel = name.trim() || target.originalName;
    setExistingColors((current) => current.map((item) => (item.key === key ? { ...item, name } : item)));
    if (previous !== nextLabel) {
      setSkus((skus) =>
        skus.map((sku) => ({
          ...sku,
          options: sku.options.map((option) =>
            option.kind === "Couleur" && option.value === previous ? { ...option, value: nextLabel } : option,
          ),
        })),
      );
    }
  }

  function replaceExistingColorPhoto(key: string, file: File) {
    setExistingColors((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (item.newFile && item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          newFile: file,
          previewUrl: URL.createObjectURL(file),
        };
      }),
    );
  }

  function removeExistingColor(key: string) {
    const target = existingColors.find((item) => item.key === key);
    if (!target) return;
    const labels = new Set(
      [target.originalName, target.name.trim()].filter(Boolean).map((value) => value.toLowerCase()),
    );
    setSkus((current) =>
      current.filter(
        (sku) =>
          !sku.options.some((option) => option.kind === "Couleur" && labels.has(option.value.toLowerCase())),
      ),
    );
    setExistingColors((current) => current.map((item) => (item.key === key ? { ...item, removed: true } : item)));
  }

  function removeSku(key: string) {
    const target = skus.find((item) => item.key === key);
    if (target?.variantId) {
      setRemovedVariantIds((ids) => (ids.includes(target.variantId!) ? ids : [...ids, target.variantId!]));
    }
    setSkus((current) => current.filter((item) => item.key !== key));
  }

  const colorPreviewUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const color of existingColors) {
      if (color.removed) continue;
      const label = color.name.trim() || color.originalName;
      if (color.previewUrl) map.set(label, color.previewUrl);
      else if (color.newFile) map.set(label, URL.createObjectURL(color.newFile));
    }
    for (const photo of product?.photos ?? []) {
      if (photo.optionKind === "Couleur" && photo.optionValue && photo.url && !map.has(photo.optionValue)) {
        map.set(photo.optionValue, photo.url);
      }
    }
    colorPhotos.forEach((draft, index) => {
      map.set(resolvedColorNames[index] ?? couleurFallback(index), URL.createObjectURL(draft.file));
    });
    return map;
  }, [colorPhotos, existingColors, product?.photos, resolvedColorNames]);

  useEffect(() => {
    const objectUrls = [
      ...resolvedColorNames.map((name) => colorPreviewUrls.get(name)),
      ...existingColors.filter((item) => item.newFile && item.previewUrl).map((item) => item.previewUrl),
    ].filter(Boolean) as string[];
    return () => {
      for (const url of objectUrls) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    };
  }, [resolvedColorNames, colorPreviewUrls, existingColors]);
  const basePrice = Number(price) || 0;
  const promoNumeric = Number(promoValue) || 0;
  const promoDiscount =
    promoMode === "percent" ? Math.round((basePrice * promoNumeric) / 100) : Math.round(promoNumeric);
  const promoPrice = Math.max(0, basePrice - promoDiscount);
  const fieldClass =
    "mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">
          {isEdit ? "Modifier le produit" : "Ajouter un produit"}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {isEdit
            ? "Infos, couleurs (nom / photo), stock des variantes."
            : "Infos → variantes (optionnel) → photos → stock."}
        </p>

        <section className="mt-5 space-y-4">
          <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">1. Infos</p>
          <label className="block">
            <span className="text-sm text-neutral-500">Nom</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Décrivez le produit…"
              className={fieldClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-neutral-500">Prix (FCFA)</span>
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-500">Catégorie</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={fieldClass}>
                <option value="">Sans catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
                className="size-4 rounded border-neutral-300"
              />
              Mettre en avant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPromo}
                onChange={(event) => setIsPromo(event.target.checked)}
                className="size-4 rounded border-neutral-300"
              />
              Promotion
            </label>
          </div>
          {isPromo ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPromoMode("percent")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                    promoMode === "percent" ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setPromoMode("amount")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                    promoMode === "amount" ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  Montant
                </button>
              </div>
              <input
                value={promoValue}
                onChange={(event) => setPromoValue(event.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder={promoMode === "percent" ? "Réduction %" : "Montant FCFA"}
                className="mt-3 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
              />
              {basePrice > 0 && promoNumeric > 0 ? (
                <p className="mt-2 text-sm text-neutral-600">
                  Prix promo : <span className="font-semibold">{formatXof(promoPrice)}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {!isEdit ? (
          <>
            <section className="mt-6 space-y-3">
              <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">2. Variantes</p>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium text-neutral-800">Ce produit a des variantes</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">Couleur = photos, taille, pointure…</span>
                </span>
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setHasVariants(enabled);
                    if (!enabled) {
                      setAxes([]);
                      setSkus([]);
                      setColorPhotos([]);
                    }
                  }}
                  className="size-4 rounded border-neutral-300"
                />
              </label>

              {hasVariants ? (
                <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
                  <div>
                    <p className="text-sm text-neutral-500">Types d’options</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {VARIANT_KINDS.map((kind) => {
                        const active = axes.some((axis) => axis.kind === kind);
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => toggleKind(kind)}
                            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                              active ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
                            }`}
                          >
                            {kind}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasCouleur ? (
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Photos des couleurs</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Une photo = une pastille. Donnez le nom de la couleur (Rouge, Fleuri…).
                      </p>
                      <div className="mt-3">
                        <ColorPhotoPicker
                          items={colorPhotos}
                          onChange={setColorPhotos}
                          max={MAX_COLOR_PHOTOS}
                          hint={`Jusqu’à ${MAX_COLOR_PHOTOS} couleurs`}
                        />
                      </div>
                    </div>
                  ) : null}

                  {axes
                    .filter((axis) => axis.kind !== "Couleur")
                    .map((axis) => (
                      <ChipField
                        key={axis.kind}
                        label={axis.kind}
                        values={axis.values}
                        placeholder={chipPlaceholder(axis.kind)}
                        onAdd={(value) => addChip(axis.kind, value)}
                        onRemove={(value) => removeChip(axis.kind, value)}
                      />
                    ))}
                </div>
              ) : null}
            </section>

            <section className="mt-6 space-y-3">
              <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">3. Photos</p>
              {hasCouleur ? (
                <p className="text-sm text-neutral-500">
                  Les pastilles du site public seront prises dans les photos Couleur (étape 2).
                </p>
              ) : (
                <PhotoPicker files={photos} onChange={setPhotos} max={MAX_PHOTOS} hint="Jusqu’à 4 photos du produit" />
              )}
            </section>
          </>
        ) : null}

        {isEdit && visibleExistingColors.length > 0 ? (
          <section className="mt-6 space-y-3">
            <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">2. Couleurs</p>
            <p className="text-sm text-neutral-500">Modifiez le nom ou la photo, ou supprimez une couleur.</p>
            <div className="space-y-3">
              {visibleExistingColors.map((color) => (
                <div
                  key={color.key}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                    <AuthImage
                      src={color.previewUrl || undefined}
                      className="size-full object-cover"
                      fallback={
                        <div className="grid size-full place-items-center text-[10px] text-neutral-400">IMG</div>
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={color.name}
                      onChange={(event) => renameExistingColor(color.key, event.target.value)}
                      placeholder="Nom de la couleur"
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800">
                        Changer la photo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) replaceExistingColorPhoto(color.key, file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeExistingColor(color.key)}
                        className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            {isEdit ? (visibleExistingColors.length > 0 ? "3. Stock" : "2. Stock") : "4. Stock"}
          </p>
          {!hasVariants || skus.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-neutral-500">Stock (optionnel)</span>
                <input
                  value={stockQty}
                  onChange={(event) => setStockQty(event.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="Ex. 45"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="text-sm text-neutral-500">Alerte stock faible</span>
                <input
                  value={lowStockThreshold}
                  onChange={(event) => setLowStockThreshold(event.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="Ex. 5"
                  className={fieldClass}
                />
              </label>
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              <div className="grid grid-cols-[auto_1fr_4.5rem_4.5rem_auto] items-center gap-2 px-2.5 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
                <span />
                <span>Variante</span>
                <span>Stock</span>
                <span>Alerte</span>
                <span />
              </div>
              {skus.map((sku) => (
                <div
                  key={sku.key}
                  className={`grid grid-cols-[auto_1fr_4.5rem_4.5rem_auto] items-center gap-2 rounded-xl border px-2.5 py-2 ${
                    sku.enabled ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sku.enabled}
                    onChange={(event) => updateSku(sku.key, { enabled: event.target.checked })}
                    className="size-4 rounded border-neutral-300"
                    title="Activer / désactiver"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    {(() => {
                      const couleur = sku.options.find((option) => option.kind === "Couleur");
                      const thumb = couleur ? colorPreviewUrls.get(couleur.value) : null;
                      const rest = sku.options
                        .filter((option) => option.kind !== "Couleur")
                        .map((option) => option.value)
                        .join(" / ");
                      const label = [couleur?.value, rest].filter(Boolean).join(" / ");
                      return (
                        <>
                          {thumb ? (
                            <AuthImage
                              src={thumb}
                              className="size-7 shrink-0 rounded-full object-cover"
                              fallback={<span className="size-7 shrink-0 rounded-full bg-neutral-200" />}
                            />
                          ) : null}
                          <p className="truncate text-sm font-medium">
                            {label || sku.options.map((option) => option.value).join(" / ")}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <input
                    value={sku.stockQty}
                    onChange={(event) => updateSku(sku.key, { stockQty: event.target.value.replace(/[^\d]/g, "") })}
                    inputMode="numeric"
                    placeholder="Qté"
                    disabled={!sku.enabled}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs outline-none focus:border-neutral-400 disabled:opacity-50"
                  />
                  <input
                    value={sku.lowStockThreshold}
                    onChange={(event) =>
                      updateSku(sku.key, { lowStockThreshold: event.target.value.replace(/[^\d]/g, "") })
                    }
                    inputMode="numeric"
                    placeholder="Ex. 5"
                    disabled={!sku.enabled}
                    title="Alerte stock faible"
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs outline-none focus:border-neutral-400 disabled:opacity-50"
                  />
                  {isEdit ? (
                    <button
                      type="button"
                      onClick={() => removeSku(sku.key)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      title="Supprimer la variante"
                    >
                      ✕
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || name.trim().length < 2 || !price || (isPromo && !promoValue)}
            onClick={() =>
              onSave({
                name,
                priceXof: Number(price),
                categoryId,
                description,
                stockQty,
                lowStockThreshold,
                isFeatured,
                isPromo,
                promoMode,
                promoValue,
                photos: hasCouleur ? [] : photos,
                colorPhotos: hasCouleur ? colorPhotos : [],
                existingColors: isEdit ? existingColors : [],
                removedVariantIds: isEdit ? removedVariantIds : [],
                skus: hasVariants ? skus : [],
              })
            }
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function initialProductForm(product: Product | null, categories: Category[]) {
  if (!product) {
    return {
      name: "",
      price: "",
      categoryId: categories[0]?.id || "",
      description: "",
      stockQty: "",
      lowStockThreshold: "",
      isFeatured: false,
      isPromo: false,
      promoMode: "percent" as const,
      promoValue: "",
      hasVariants: false,
      axes: [] as VariantAxisDraft[],
      skus: [] as SkuDraft[],
    };
  }

  const onPromo = Boolean(product.compareAtPriceXof && product.compareAtPriceXof > product.priceXof);
  const basePrice = onPromo ? product.compareAtPriceXof! : product.priceXof;
  const variants = product.variants ?? [];
  const skus: SkuDraft[] = variants.map((variant) => {
    const options = (variant.options?.length
      ? variant.options
      : [
          variant.option1Kind && variant.option1Value
            ? { kind: variant.option1Kind, value: variant.option1Value }
            : null,
          variant.option2Kind && variant.option2Value
            ? { kind: variant.option2Kind, value: variant.option2Value }
            : null,
        ].filter(Boolean)) as Array<{ kind: string; value: string }>;
    const normalized = options.map((option) => ({
      kind: (VARIANT_KINDS.includes(option.kind as VariantKind) ? option.kind : "Couleur") as VariantKind,
      value: option.value,
    }));
    return {
      key: variant.id,
      variantId: variant.id,
      options: normalized.length
        ? normalized
        : [{ kind: "Couleur" as const, value: variant.name }],
      stockQty: variant.stockQty == null ? "" : String(variant.stockQty),
      lowStockThreshold: variant.lowStockThreshold == null ? "" : String(variant.lowStockThreshold),
      enabled: variant.isActive,
    };
  });

  return {
    name: product.name,
    price: String(basePrice),
    categoryId: product.category?.id || "",
    description: product.description || "",
    stockQty: product.stockQty == null ? "" : String(product.stockQty),
    lowStockThreshold: product.lowStockThreshold == null ? "" : String(product.lowStockThreshold),
    isFeatured: product.isFeatured,
    isPromo: onPromo,
    promoMode: "amount" as const,
    promoValue: onPromo ? String(basePrice - product.priceXof) : "",
    hasVariants: variants.length > 0,
    axes: [] as VariantAxisDraft[],
    skus,
  };
}

function PhotoPicker({
  files,
  onChange,
  max,
  hint,
  compact = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  hint?: string;
  compact?: boolean;
}) {
  const [inputKey, setInputKey] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [files]);

  function appendFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= max) break;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) continue;
      next.push(file);
    }
    onChange(next);
    setInputKey((value) => value + 1);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
    setInputKey((value) => value + 1);
  }

  const tile = compact ? "size-16" : "aspect-square";

  return (
    <div>
      {hint ? <p className="mb-2 text-sm text-neutral-500">{hint}</p> : null}
      <div className={`grid gap-2 ${compact ? "grid-cols-[repeat(auto-fill,4rem)]" : "grid-cols-4"}`}>
        {previews.map((src, index) => (
          <div
            key={`${inputKey}-${index}-${files[index]?.name ?? "photo"}`}
            className={`relative overflow-hidden rounded-2xl bg-neutral-100 ${tile}`}
          >
            <img src={src} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {files.length < max ? (
          <label
            className={`grid cursor-pointer place-items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-500 ${tile}`}
          >
            + Photo
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                appendFiles(event.target.files);
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ColorPhotoPicker({
  items,
  onChange,
  max,
  hint,
}: {
  items: ColorPhotoDraft[];
  onChange: (items: ColorPhotoDraft[]) => void;
  max: number;
  hint?: string;
}) {
  const [inputKey, setInputKey] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = items.map((item) => URL.createObjectURL(item.file));
    setPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [items]);

  function appendFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...items];
    for (const file of Array.from(list)) {
      if (next.length >= max) break;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) continue;
      next.push({ file, name: "" });
    }
    onChange(next);
    setInputKey((value) => value + 1);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
    setInputKey((value) => value + 1);
  }

  function renameAt(index: number, name: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, name } : item)));
  }

  return (
    <div>
      {hint ? <p className="mb-2 text-sm text-neutral-500">{hint}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {previews.map((src, index) => (
          <div key={`${inputKey}-${index}-${items[index]?.file.name ?? "photo"}`} className="space-y-2">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-100">
              <img src={src} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white"
              >
                ✕
              </button>
            </div>
            <input
              value={items[index]?.name ?? ""}
              onChange={(event) => renameAt(index, event.target.value)}
              placeholder={`Ex. Rouge`}
              aria-label={`Nom de la couleur ${index + 1}`}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none focus:border-neutral-400"
            />
          </div>
        ))}
        {items.length < max ? (
          <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-500">
            + Photo
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                appendFiles(event.target.files);
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ChipField({
  label,
  values,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    onAdd(draft);
    setDraft("");
  }

  return (
    <div>
      <p className="text-sm font-medium text-neutral-800">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onRemove(value)}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
            title="Retirer"
          >
            {value} ×
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
        <button
          type="button"
          onClick={commit}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function chipPlaceholder(kind: VariantKind) {
  if (kind === "Taille") return "Ex. M puis Entrée";
  return "Ex. 40 puis Entrée";
}

const actionBtnClass =
  "rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-40";

function isVariantLowStock(variant: ProductVariant) {
  return (
    variant.stockQty != null &&
    variant.lowStockThreshold != null &&
    variant.stockQty > 0 &&
    variant.stockQty <= variant.lowStockThreshold
  );
}

function lowStockVariants(product: Product) {
  return (product.variants ?? []).filter((variant) => variant.isActive && isVariantLowStock(variant));
}

function outOfStockVariants(product: Product) {
  return (product.variants ?? []).filter((variant) => variant.isActive && variant.stockQty === 0);
}

function isLowStock(product: Product) {
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  if (variants.length > 0) return lowStockVariants(product).length > 0;
  if (product.stockQty == null || product.lowStockThreshold == null) return false;
  return product.stockQty > 0 && product.stockQty <= product.lowStockThreshold;
}

function hasOutOfStock(product: Product) {
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  if (variants.length > 0) return outOfStockVariants(product).length > 0;
  return product.availability === "OUT_OF_STOCK" || product.stockQty === 0;
}

function statusFor(product: Product) {
  if (!product.isActive) return { label: "Archivé", className: "bg-neutral-200 text-neutral-600" };
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  if (variants.length > 0) {
    if (variants.every((variant) => variant.stockQty === 0)) {
      return { label: "Rupture", className: "bg-red-100 text-red-700" };
    }
    if (outOfStockVariants(product).length > 0) {
      return { label: "Rupture partielle", className: "bg-red-100 text-red-700" };
    }
  } else if (product.availability === "OUT_OF_STOCK" || product.stockQty === 0) {
    return { label: "Rupture", className: "bg-red-100 text-red-700" };
  }
  if (isLowStock(product)) return { label: "Stock faible", className: "bg-amber-100 text-amber-800" };
  return { label: "Actif", className: "bg-emerald-100 text-emerald-700" };
}

function stockLabel(product: Product) {
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  if (variants.length > 0) {
    const total = variants.reduce((sum, variant) => sum + (variant.stockQty ?? 0), 0);
    return String(total);
  }
  if (product.stockQty != null) return String(product.stockQty);
  if (product.availability === "OUT_OF_STOCK") return "0";
  if (product.availability === "MADE_TO_ORDER") return "∞";
  return "—";
}

function buildSkuMatrix(axes: VariantAxisDraft[]): SkuDraft[] {
  const prepared = axes.filter((axis) => axis.values.length > 0);
  if (prepared.length === 0) return [];

  let combos: Array<Array<{ kind: VariantKind; value: string }>> = [[]];
  for (const axis of prepared) {
    const next: Array<Array<{ kind: VariantKind; value: string }>> = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push([...combo, { kind: axis.kind, value }]);
      }
    }
    combos = next;
  }

  return combos.map((options) => ({
    key: options.map((option) => `${option.kind}:${option.value}`).join("|"),
    options,
    stockQty: "",
    lowStockThreshold: "",
    enabled: true,
  }));
}

function mergeSkuMatrix(next: SkuDraft[], previous: SkuDraft[]) {
  const prevByKey = new Map(previous.map((item) => [item.key, item]));
  return next.map((item) => {
    const existing = prevByKey.get(item.key);
    if (!existing) return item;
    return {
      ...item,
      stockQty: existing.stockQty,
      lowStockThreshold: existing.lowStockThreshold,
      enabled: existing.enabled,
    };
  });
}

function variantOptions(variant: ProductVariant): Array<{ kind: string; value: string }> {
  if (variant.options?.length) {
    return variant.options.map((option) => ({ kind: option.kind, value: option.value }));
  }
  return [
    variant.option1Kind && variant.option1Value
      ? { kind: variant.option1Kind, value: variant.option1Value }
      : null,
    variant.option2Kind && variant.option2Value
      ? { kind: variant.option2Kind, value: variant.option2Value }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string }>;
}

function variantHasCouleur(variant: ProductVariant, colorName: string) {
  const needle = colorName.trim().toLowerCase();
  return variantOptions(variant).some(
    (option) => option.kind === "Couleur" && option.value.trim().toLowerCase() === needle,
  );
}

function buildExistingColors(product: Product): ExistingColorDraft[] {
  const byKey = new Map<string, ExistingColorDraft>();

  for (const photo of product.photos ?? []) {
    if (photo.optionKind !== "Couleur" || !photo.optionValue?.trim()) continue;
    const name = photo.optionValue.trim();
    const key = name.toLowerCase();
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key: photo.id,
      photoId: photo.id,
      originalName: name,
      name,
      previewUrl: photo.url,
      newFile: null,
      removed: false,
    });
  }

  for (const variant of product.variants ?? []) {
    for (const option of variantOptions(variant)) {
      if (option.kind !== "Couleur" || !option.value.trim()) continue;
      const name = option.value.trim();
      const key = name.toLowerCase();
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key: `color:${name}`,
        photoId: null,
        originalName: name,
        name,
        previewUrl: null,
        newFile: null,
        removed: false,
      });
    }
  }

  return [...byKey.values()];
}

