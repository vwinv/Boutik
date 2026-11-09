import { Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { API_ERROR_CODES, capabilitiesFor, isCapability, type Capability } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import {
  catalogPlanInclude,
  catalogTemplateInclude,
  presentCategory,
  presentPlan,
  presentTemplate,
} from "./catalog.presenter";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(activeOnly = true) {
    const categories = await this.prisma.siteCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        subcategories: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return Promise.all(
      categories.map(async (category) =>
        presentCategory(category, {
          planCount: await this.prisma.plan.count({
            where: { category: category.code, ...(activeOnly ? { isActive: true } : {}) },
          }),
          templateCount: await this.prisma.templateCategory.count({
            where: {
              category: category.code,
              ...(activeOnly ? { template: { isActive: true } } : {}),
            },
          }),
        }),
      ),
    );
  }

  async listPlans(category?: Category, activeOnly = true) {
    const plans = await this.prisma.plan.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        prices: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { interval: "asc" },
        },
        options: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
    return plans.map(presentPlan);
  }

  async listTemplates(category?: Category, activeOnly = true) {
    const templates = await this.prisma.siteTemplate.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(category ? { categories: { some: { category } } } : {}),
      },
      include: catalogTemplateInclude,
      orderBy: { sortOrder: "asc" },
    });
    return templates.map(presentTemplate);
  }

  async defaultPlan(category: Category) {
    const plan = await this.prisma.plan.findFirst({
      where: { category, isActive: true, isDefault: true },
      include: catalogPlanInclude,
    });
    if (plan) {
      return plan;
    }
    return this.prisma.plan.findFirst({
      where: { category, isActive: true },
      include: catalogPlanInclude,
      orderBy: { sortOrder: "asc" },
    });
  }

  async requirePlan(planId: string, category: Category) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: catalogPlanInclude,
    });
    if (!plan || !plan.isActive) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    if (plan.category !== category) {
      throw new ApiException(API_ERROR_CODES.CATEGORY_MISMATCH, "Cette offre ne correspond pas à la catégorie du site");
    }
    return plan;
  }

  async requireSubcategory(subcategoryId: string, category: Category) {
    const subcategory = await this.prisma.siteSubcategory.findUnique({ where: { id: subcategoryId } });
    if (!subcategory || !subcategory.isActive) {
      throw new ApiException(API_ERROR_CODES.SUBCATEGORY_NOT_FOUND);
    }
    if (subcategory.category !== category) {
      throw new ApiException(API_ERROR_CODES.CATEGORY_MISMATCH, "Cette sous-catégorie ne correspond pas au site");
    }
    return subcategory;
  }

  async requireTemplate(templateId: string, category: Category, includesPremium: boolean) {
    const template = await this.prisma.siteTemplate.findUnique({
      where: { id: templateId },
      include: catalogTemplateInclude,
    });
    if (!template || !template.isActive) {
      throw new ApiException(API_ERROR_CODES.TEMPLATE_NOT_FOUND);
    }
    if (!template.categories.some((item) => item.category === category)) {
      throw new ApiException(API_ERROR_CODES.CATEGORY_MISMATCH, "Ce modèle n'est pas compatible avec la catégorie du site");
    }
    if (template.isPremium && !includesPremium) {
      throw new ApiException(API_ERROR_CODES.PREMIUM_TEMPLATE_FORBIDDEN);
    }
    return template;
  }

  async requireOptions(optionIds: string[], planId: string) {
    if (optionIds.length === 0) {
      return [];
    }
    const uniqueIds = [...new Set(optionIds)];
    const options = await this.prisma.planOption.findMany({
      where: { id: { in: uniqueIds }, planId, isActive: true },
    });
    if (options.length !== uniqueIds.length) {
      throw new ApiException(API_ERROR_CODES.OPTION_NOT_FOUND);
    }
    return options;
  }

  requirePrice(plan: { prices: { interval: "MONTHLY" | "YEARLY"; isActive: boolean }[] }, interval: "MONTHLY" | "YEARLY") {
    const price = plan.prices.find((item) => item.interval === interval && item.isActive);
    if (!price) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Aucun tarif actif pour cet intervalle");
    }
    return price;
  }

  sanitizeCapabilities(category: Category, capabilities: string[]): Capability[] {
    const invalid = capabilities.filter((item) => !isCapability(item) || !capabilitiesFor(category).includes(item));
    if (invalid.length > 0) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Capacité invalide pour cette catégorie", { invalid });
    }
    return capabilities as Capability[];
  }
}
