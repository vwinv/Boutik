import type { Category, PlatformModule, TenantModule } from "@prisma/client";

const CATEGORY_LABEL: Record<Category, string> = {
  BOUTIQUE: "Boutique",
  RESTAURANT: "Restaurant",
  VITRINE: "Site vitrine",
};

export function presentPlatformModule(
  module: PlatformModule & { activations?: TenantModule[] },
  opts?: { tenantCategory?: Category; active?: boolean },
) {
  const categories = module.categories.length
    ? module.categories
    : (["BOUTIQUE", "RESTAURANT", "VITRINE"] as Category[]);
  return {
    id: module.id,
    slug: module.slug,
    name: module.name,
    description: module.description,
    amountXof: module.amountXof,
    isActive: module.isActive,
    sortOrder: module.sortOrder,
    categories,
    categoryLabels: categories.map((code) => CATEGORY_LABEL[code]),
    activationsCount: module.activations?.length ?? undefined,
    activated: opts?.active ?? false,
    availableForTenant:
      opts?.tenantCategory == null ||
      categories.length === 0 ||
      categories.includes(opts.tenantCategory),
  };
}
