import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES, type Category } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "./catalog.service";
import {
  catalogPlanInclude,
  catalogTemplateInclude,
  presentOption,
  presentPlan,
  presentSubcategory,
  presentTemplate,
} from "./catalog.presenter";
import type {
  CreatePlanDto,
  CreatePlanOptionDto,
  CreateSubcategoryDto,
  CreateTemplateDto,
  PlanPriceDto,
  UpdatePlanDto,
  UpdatePlanOptionDto,
  UpdateSiteCategoryDto,
  UpdateSubcategoryDto,
  UpdateTemplateDto,
} from "./dto/admin-catalog.dto";

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  listCategories() {
    return this.catalog.listCategories(false);
  }

  async updateCategory(code: Category, input: UpdateSiteCategoryDto) {
    const category = await this.prisma.siteCategory.update({
      where: { code },
      data: input,
      include: { subcategories: { orderBy: { sortOrder: "asc" } } },
    });
    return (await this.catalog.listCategories(false)).find((item) => item.code === category.code);
  }

  async createSubcategory(input: CreateSubcategoryDto) {
    await this.requireCategory(input.category);
    const created = await this.prisma.siteSubcategory.create({
      data: {
        category: input.category,
        slug: input.slug,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return presentSubcategory(created);
  }

  async updateSubcategory(id: string, input: UpdateSubcategoryDto) {
    await this.requireSubcategoryRecord(id);
    return presentSubcategory(
      await this.prisma.siteSubcategory.update({
        where: { id },
        data: input,
      }),
    );
  }

  async deleteSubcategory(id: string) {
    await this.requireSubcategoryRecord(id);
    await this.prisma.siteSubcategory.delete({ where: { id } });
    return { deleted: true };
  }

  listPlans() {
    return this.catalog.listPlans(undefined, false);
  }

  /** Vue admin Offres — 3 formules Découverte / Pro / Business + matrice. */
  async listOffersOverview(category?: Category) {
    const resolvedCategory = category ?? "BOUTIQUE";
    const plans = await this.prisma.plan.findMany({
      where: {
        isActive: true,
        category: resolvedCategory,
      },
      include: {
        prices: { where: { isActive: true } },
        _count: { select: { tenants: { where: { status: { not: "ARCHIVED" } } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const hasCommerce = resolvedCategory === "BOUTIQUE" || resolvedCategory === "RESTAURANT";
    const catalogLabel = resolvedCategory === "RESTAURANT" ? "Plats" : "Produits";
    const categoryLabel =
      resolvedCategory === "RESTAURANT"
        ? "Restaurant"
        : resolvedCategory === "VITRINE"
          ? "Site vitrine"
          : "Boutique";

    const tiers = plans.map((plan) => {
      const tierKey = planTierKey(plan.name, plan.slug);
      const defaults = OFFER_TIERS.find((tier) => tier.key === tierKey);
      const monthlyXof =
        plan.prices.find((price) => price.interval === "MONTHLY")?.amountXof ?? defaults?.monthlyXof ?? 0;
      const yearlyXof =
        plan.prices.find((price) => price.interval === "YEARLY")?.amountXof ?? defaults?.yearlyXof ?? 0;
      const commissionPct = hasCommerce ? (plan.commissionPct ?? defaults?.commissionPct ?? null) : null;
      const maxCatalogItems = hasCommerce
        ? (plan.maxCatalogItems ?? defaults?.maxProducts ?? null)
        : null;
      const maxCollaborators = plan.maxCollaborators ?? defaults?.maxCollaborators ?? 1;
      const maxAppointments = plan.maxAppointments ?? null;

      return {
        key: plan.id,
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        category: plan.category,
        featured: tierKey === "pro" || plan.sortOrder === 2,
        isActive: plan.isActive,
        statusLabel: plan.isActive ? "Actif" : "Inactif",
        monthlyXof,
        yearlyXof,
        commissionPct,
        maxCatalogItems,
        maxAppointments,
        maxCollaborators,
        trialDays: defaults?.trialDays ?? 0,
        subscribersCount: plan._count.tenants,
        planIds: [plan.id],
        plans: [{ id: plan.id, category: plan.category }],
        highlight: buildTierHighlight({
          hasCommerce,
          commissionPct,
          maxCatalogItems,
          maxCollaborators,
          catalogLabel,
        }),
        features: {
          title: "Fonctionnalités par offre",
          subtitle: `${categoryLabel} · ${plan.name}`,
          sections: [
            {
              title: "Tarifs et limites",
              rows: buildLimitRows({
                monthlyXof,
                commissionPct,
                maxCatalogItems,
                maxCollaborators,
                hasCommerce,
                catalogLabel,
              }),
            },
          ],
        },
      };
    });

    return {
      category: resolvedCategory,
      categoryLabel,
      tiers,
    };
  }

  async createPlan(input: CreatePlanDto) {
    await this.requireCategory(input.category);
    const capabilities = this.catalog.sanitizeCapabilities(input.category, input.capabilities);
    const plan = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.plan.updateMany({ where: { category: input.category, isDefault: true }, data: { isDefault: false } });
      }
      return tx.plan.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          category: input.category,
          isActive: input.isActive ?? true,
          isDefault: input.isDefault ?? false,
          includesPremiumTemplates: input.includesPremiumTemplates ?? false,
          sortOrder: input.sortOrder ?? 0,
          capabilities,
          commissionPct: normalizeOptionalLimit(input.commissionPct),
          maxCatalogItems: normalizeOptionalLimit(input.maxCatalogItems),
          maxCollaborators: input.maxCollaborators ?? 1,
          maxAppointments: normalizeOptionalLimit(input.maxAppointments),
          graceDays: input.graceDays ?? 7,
          expiredRestriction: input.expiredRestriction ?? "READ_ONLY",
          prices: {
            create: input.prices.map((price) => ({
              interval: price.interval,
              amountXof: price.amountXof,
              isActive: price.isActive ?? true,
            })),
          },
        },
        include: catalogPlanInclude,
      });
    });
    return presentPlan(plan);
  }

  async updatePlan(id: string, input: UpdatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    const capabilities = input.capabilities
      ? this.catalog.sanitizeCapabilities(existing.category, input.capabilities)
      : undefined;

    const plan = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.plan.updateMany({
          where: { category: existing.category, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      if (input.prices) {
        await tx.planPrice.deleteMany({ where: { planId: id } });
        await tx.planPrice.createMany({
          data: input.prices.map((price) => ({
            planId: id,
            interval: price.interval,
            amountXof: price.amountXof,
            isActive: price.isActive ?? true,
          })),
        });
      }
      return tx.plan.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          isDefault: input.isDefault,
          includesPremiumTemplates: input.includesPremiumTemplates,
          sortOrder: input.sortOrder,
          capabilities,
          commissionPct:
            input.commissionPct === undefined ? undefined : normalizeOptionalLimit(input.commissionPct),
          maxCatalogItems:
            input.maxCatalogItems === undefined
              ? undefined
              : normalizeOptionalLimit(input.maxCatalogItems),
          maxCollaborators: input.maxCollaborators,
          maxAppointments:
            input.maxAppointments === undefined
              ? undefined
              : normalizeOptionalLimit(input.maxAppointments),
          graceDays: input.graceDays,
          expiredRestriction: input.expiredRestriction,
        },
        include: catalogPlanInclude,
      });
    });
    return presentPlan(plan);
  }

  async deletePlan(id: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    await this.prisma.plan.delete({ where: { id } });
    return { deleted: true };
  }

  async replacePrices(id: string, prices: PlanPriceDto[]) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.planPrice.deleteMany({ where: { planId: id } });
      await tx.planPrice.createMany({
        data: prices.map((price) => ({
          planId: id,
          interval: price.interval,
          amountXof: price.amountXof,
          isActive: price.isActive ?? true,
        })),
      });
      return tx.plan.findUniqueOrThrow({ where: { id }, include: catalogPlanInclude });
    });
    return presentPlan(plan);
  }

  async createOption(planId: string, input: CreatePlanOptionDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new ApiException(API_ERROR_CODES.PLAN_NOT_FOUND);
    }
    if (input.capability) {
      this.catalog.sanitizeCapabilities(plan.category, [input.capability]);
    }
    return presentOption(
      await this.prisma.planOption.create({
        data: {
          planId,
          slug: input.slug,
          name: input.name,
          description: input.description,
          amountXof: input.amountXof,
          capability: input.capability,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      }),
    );
  }

  async updateOption(planId: string, optionId: string, input: UpdatePlanOptionDto) {
    const option = await this.prisma.planOption.findFirst({ where: { id: optionId, planId } });
    if (!option) {
      throw new ApiException(API_ERROR_CODES.OPTION_NOT_FOUND);
    }
    if (input.capability) {
      const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });
      this.catalog.sanitizeCapabilities(plan.category, [input.capability]);
    }
    return presentOption(
      await this.prisma.planOption.update({
        where: { id: optionId },
        data: input,
      }),
    );
  }

  async deleteOption(planId: string, optionId: string) {
    const option = await this.prisma.planOption.findFirst({ where: { id: optionId, planId } });
    if (!option) {
      throw new ApiException(API_ERROR_CODES.OPTION_NOT_FOUND);
    }
    await this.prisma.planOption.delete({ where: { id: optionId } });
    return { deleted: true };
  }

  listTemplates() {
    return this.catalog.listTemplates(undefined, false);
  }

  async createTemplate(input: CreateTemplateDto) {
    const template = await this.prisma.siteTemplate.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        isPremium: input.isPremium ?? false,
        isActive: input.isActive ?? true,
        previewUrl: input.previewUrl,
        thumbnailUrl: input.thumbnailUrl,
        sortOrder: input.sortOrder ?? 0,
        categories: {
          create: input.categories.map((category) => ({ category })),
        },
      },
      include: catalogTemplateInclude,
    });
    return presentTemplate(template);
  }

  async updateTemplate(id: string, input: UpdateTemplateDto) {
    const existing = await this.prisma.siteTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.TEMPLATE_NOT_FOUND);
    }
    const template = await this.prisma.$transaction(async (tx) => {
      if (input.categories) {
        await tx.templateCategory.deleteMany({ where: { templateId: id } });
        await tx.templateCategory.createMany({
          data: input.categories.map((category) => ({ templateId: id, category })),
        });
      }
      return tx.siteTemplate.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isPremium: input.isPremium,
          isActive: input.isActive,
          previewUrl: input.previewUrl,
          thumbnailUrl: input.thumbnailUrl,
          sortOrder: input.sortOrder,
        },
        include: catalogTemplateInclude,
      });
    });
    return presentTemplate(template);
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.siteTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.TEMPLATE_NOT_FOUND);
    }
    await this.prisma.siteTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireCategory(code: Category) {
    const category = await this.prisma.siteCategory.findUnique({ where: { code } });
    if (!category) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Catégorie introuvable");
    }
    return category;
  }

  private async requireSubcategoryRecord(id: string) {
    const subcategory = await this.prisma.siteSubcategory.findUnique({ where: { id } });
    if (!subcategory) {
      throw new ApiException(API_ERROR_CODES.SUBCATEGORY_NOT_FOUND);
    }
    return subcategory;
  }
}

const OFFER_TIERS = [
  {
    key: "decouverte" as const,
    name: "Découverte",
    featured: false,
    monthlyXof: 0,
    yearlyXof: 0,
    commissionPct: 5,
    maxProducts: 20,
    maxCollaborators: 1,
    trialDays: 0,
  },
  {
    key: "pro" as const,
    name: "Pro",
    featured: true,
    monthlyXof: 9900,
    yearlyXof: 99000,
    commissionPct: 2.5,
    maxProducts: 200,
    maxCollaborators: 3,
    trialDays: 14,
  },
  {
    key: "business" as const,
    name: "Business",
    featured: false,
    monthlyXof: 24900,
    yearlyXof: 249000,
    commissionPct: 1.5,
    maxProducts: null as number | null,
    maxCollaborators: 10,
    trialDays: 14,
  },
];

function planTierKey(name: string, slug: string): "decouverte" | "pro" | "business" | null {
  const hay = `${name} ${slug}`.toLowerCase();
  if (hay.includes("business")) return "business";
  if (
    hay.includes("découverte") ||
    hay.includes("decouverte") ||
    hay.includes("starter") ||
    /(^|-)discovery($|-)/.test(hay)
  ) {
    return "decouverte";
  }
  if (/\bpro\b/.test(hay) || hay.includes("-pro") || hay.endsWith("pro")) return "pro";
  return null;
}

function formatPct(value: number) {
  return `${String(value).replace(".", ",")} %`;
}

function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

function normalizeOptionalLimit(value: number | null | undefined) {
  if (value == null) return null;
  return value;
}

function buildTierHighlight(input: {
  hasCommerce: boolean;
  commissionPct: number | null;
  maxCatalogItems: number | null;
  maxCollaborators: number;
  catalogLabel: string;
}) {
  const lines: string[] = [];
  if (input.hasCommerce) {
    lines.push(
      `Commission ${input.commissionPct == null ? "—" : formatPct(input.commissionPct)}`,
    );
    lines.push(
      input.maxCatalogItems == null
        ? `${input.catalogLabel} illimités`
        : `${input.maxCatalogItems} ${input.catalogLabel.toLowerCase()}`,
    );
  }
  lines.push(
    `${input.maxCollaborators} collaborateur${input.maxCollaborators > 1 ? "s" : ""}`,
  );
  return lines;
}

function buildLimitRows(input: {
  monthlyXof: number;
  commissionPct: number | null;
  maxCatalogItems: number | null;
  maxCollaborators: number;
  hasCommerce: boolean;
  catalogLabel: string;
}) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Prix mensuel",
      value: input.monthlyXof <= 0 ? "Gratuit" : formatXof(input.monthlyXof),
    },
  ];
  if (input.hasCommerce) {
    rows.push({
      label: "Commission",
      value: input.commissionPct == null ? "—" : formatPct(input.commissionPct),
    });
    rows.push({
      label: input.catalogLabel,
      value: input.maxCatalogItems == null ? "Illimité" : String(input.maxCatalogItems),
    });
  }
  rows.push({
    label: "Collaborateurs",
    value: String(input.maxCollaborators),
  });
  return rows;
}
