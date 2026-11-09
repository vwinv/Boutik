import type {
  Plan,
  PlanOption,
  PlanPrice,
  SiteCategory,
  SiteSubcategory,
  SiteTemplate,
  TemplateCategory,
} from "@prisma/client";
import { capabilitiesFor, type Capability, type Category } from "@boutik/domain";
import { capabilitiesFromOffering } from "./effective-capabilities";

export const catalogPlanInclude = {
  prices: { orderBy: { interval: "asc" as const } },
  options: { orderBy: { sortOrder: "asc" as const } },
} as const;

export const catalogTemplateInclude = {
  categories: true,
} as const;

export const offeringInclude = {
  subcategory: true,
  plan: { include: catalogPlanInclude },
  template: { include: catalogTemplateInclude },
  selectedOptions: { include: { option: true } },
} as const;

export function presentSubcategory(item: SiteSubcategory) {
  return {
    id: item.id,
    category: item.category,
    slug: item.slug,
    name: item.name,
    description: item.description,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  };
}

export function presentPrice(price: PlanPrice) {
  return {
    id: price.id,
    interval: price.interval,
    amountXof: price.amountXof,
    isActive: price.isActive,
  };
}

export function presentOption(option: PlanOption) {
  return {
    id: option.id,
    slug: option.slug,
    name: option.name,
    description: option.description,
    amountXof: option.amountXof,
    capability: option.capability as Capability | null,
    isActive: option.isActive,
    sortOrder: option.sortOrder,
  };
}

export function presentPlan(plan: Plan & { prices: PlanPrice[]; options: PlanOption[] }) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    category: plan.category,
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    includesPremiumTemplates: plan.includesPremiumTemplates,
    sortOrder: plan.sortOrder,
    commissionPct: plan.commissionPct,
    maxCatalogItems: plan.maxCatalogItems,
    maxCollaborators: plan.maxCollaborators,
    maxAppointments: plan.maxAppointments,
    graceDays: plan.graceDays,
    expiredRestriction: plan.expiredRestriction,
    capabilities: plan.capabilities.filter((item): item is Capability =>
      capabilitiesFor(plan.category).includes(item as Capability),
    ),
    prices: plan.prices.map(presentPrice),
    options: plan.options.map(presentOption),
  };
}

export function presentTemplate(template: SiteTemplate & { categories: TemplateCategory[] }) {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    isPremium: template.isPremium,
    isActive: template.isActive,
    previewUrl: template.previewUrl,
    thumbnailUrl: template.thumbnailUrl,
    sortOrder: template.sortOrder,
    categories: template.categories.map((item) => item.category),
  };
}

export function presentCategory(
  category: SiteCategory & { subcategories: SiteSubcategory[] },
  extras?: { planCount?: number; templateCount?: number },
) {
  return {
    code: category.code as Category,
    label: category.label,
    description: category.description,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    capabilities: capabilitiesFor(category.code),
    subcategories: category.subcategories.map(presentSubcategory),
    planCount: extras?.planCount,
    templateCount: extras?.templateCount,
  };
}

export function presentOffering(tenant: {
  category: Category;
  planInterval: "MONTHLY" | "YEARLY";
  subcategory: SiteSubcategory | null;
  plan: (Plan & { prices: PlanPrice[]; options: PlanOption[] }) | null;
  template: (SiteTemplate & { categories: TemplateCategory[] }) | null;
  selectedOptions: Array<{ option: PlanOption }>;
}) {
  return {
    subcategory: tenant.subcategory ? presentSubcategory(tenant.subcategory) : null,
    plan: tenant.plan ? presentPlan(tenant.plan) : null,
    interval: tenant.planInterval,
    options: tenant.selectedOptions.map((item) => presentOption(item.option)),
    template: tenant.template ? presentTemplate(tenant.template) : null,
    capabilities: capabilitiesFromOffering(tenant),
  };
}
