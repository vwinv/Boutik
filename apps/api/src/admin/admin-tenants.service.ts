import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { presentProfessional } from "../professionals/professional.presenter";
import { presentWorkspace, workspaceWithRelations } from "../professionals/workspace.presenter";

@Injectable()
export class AdminTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comptes pro (inscription + professionnels), pas seulement les espaces publiés.
   * Un compte inscrit qui n’a pas encore d’espace reste visible ici.
   */
  async listProfessionnels() {
    const users = await this.prisma.user.findMany({
      where: {
        staffRole: "NONE",
        OR: [
          { professionals: { some: {} } },
          { memberships: { some: {} } },
          { onboardingCategory: { not: null } },
          {
            AND: [{ phone: { not: null } }, { customers: { none: {} } }],
          },
        ],
      },
      include: {
        professionals: {
          include: {
            tenants: {
              where: { status: { not: "ARCHIVED" } },
              include: {
                site: { select: { status: true } },
                plan: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        memberships: {
          where: { tenant: { status: { not: "ARCHIVED" } } },
          include: {
            tenant: {
              include: {
                site: { select: { status: true } },
                plan: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = users.map((user) => {
      const byId = new Map<
        string,
        {
          id: string;
          name: string;
          slug: string;
          status: string;
          category: string;
          planName: string;
          siteStatus: string;
        }
      >();

      for (const professional of user.professionals) {
        for (const tenant of professional.tenants) {
          byId.set(tenant.id, {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            category: tenant.category,
            planName: tenant.plan?.name ?? "—",
            siteStatus: tenant.site?.status ?? "DRAFT",
          });
        }
      }
      for (const membership of user.memberships) {
        const tenant = membership.tenant;
        byId.set(tenant.id, {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          category: tenant.category,
          planName: tenant.plan?.name ?? "—",
          siteStatus: tenant.site?.status ?? "DRAFT",
        });
      }

      const spaces = [...byId.values()].map((space) => ({
        ...space,
        categoryLabel: categoryLabel(space.category),
        statusLabel: accountStatusLabel(space.status),
        siteStatusLabel: siteStatusLabel(space.siteStatus),
        planTier: planTierLabel(space.planName),
      }));

      const stage =
        spaces.length === 0
          ? user.phoneVerifiedAt
            ? "ONBOARDING"
            : "PENDING_PHONE"
          : spaces.every((space) => space.status === "SUSPENDED")
            ? "SUSPENDED"
            : "ACTIVE";

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneVerified: Boolean(user.phoneVerifiedAt),
        emailVerified: Boolean(user.emailVerifiedAt),
        onboardingCategory: user.onboardingCategory,
        onboardingCategoryLabel: user.onboardingCategory
          ? categoryLabel(user.onboardingCategory)
          : null,
        stage,
        stageLabel: stageLabel(stage),
        professionalId: user.professionals[0]?.id ?? null,
        professionalName: user.professionals[0]?.displayName || user.name,
        spacesCount: spaces.length,
        spaces,
        createdAt: user.createdAt.toISOString(),
      };
    });

    return {
      kpis: {
        totalCount: items.length,
        onboardingCount: items.filter(
          (item) => item.stage === "ONBOARDING" || item.stage === "PENDING_PHONE",
        ).length,
        withSpaceCount: items.filter((item) => item.spacesCount > 0).length,
        suspendedCount: items.filter((item) => item.stage === "SUSPENDED").length,
      },
      items,
    };
  }

  /** Liste admin des espaces (sites) — complémentaire à listProfessionnels. */
  async listEspaces() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: workspaceWithRelations,
      orderBy: { createdAt: "desc" },
    });

    const tenantIds = tenants.map((row) => row.id);
    const [credits, debits] = await Promise.all([
      this.prisma.walletLedgerEntry.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds }, type: "CREDIT", reason: "ORDER_SALE" },
        _sum: { amountXof: true },
      }),
      this.prisma.walletLedgerEntry.groupBy({
        by: ["tenantId"],
        where: {
          tenantId: { in: tenantIds },
          type: "DEBIT",
          reason: { in: ["WITHDRAWAL", "REFUND"] },
        },
        _sum: { amountXof: true },
      }),
    ]);
    const creditMap = new Map(credits.map((row) => [row.tenantId, row._sum.amountXof ?? 0]));
    const debitMap = new Map(debits.map((row) => [row.tenantId, row._sum.amountXof ?? 0]));

    const items = tenants.map((tenant) => {
      const presented = presentWorkspace(tenant);
      const walletXof = Math.max(0, (creditMap.get(tenant.id) ?? 0) - (debitMap.get(tenant.id) ?? 0));
      const planName = tenant.plan?.name ?? "—";
      const planTier = planTierLabel(planName);
      return {
        id: presented.id,
        name: presented.name,
        slug: presented.slug,
        category: presented.category,
        categoryLabel: categoryLabel(presented.category),
        status: presented.status,
        statusLabel: accountStatusLabel(presented.status),
        planName,
        planTier,
        siteStatus: presented.site?.status ?? "DRAFT",
        siteStatusLabel: siteStatusLabel(presented.site?.status ?? "DRAFT"),
        siteHost: presented.site?.host ?? `${presented.slug}.boutik.app`,
        siteUrl: presented.site?.url ?? null,
        walletXof,
        professionalName: presented.professional.displayName || presented.name,
        ownerName: presented.owner?.name ?? null,
        ownerEmail: presented.owner?.email ?? null,
        createdAt: presented.createdAt,
      };
    });

    const total = items.length;
    const activeCount = items.filter((item) => item.status === "ACTIVE").length;
    const publishedCount = items.filter((item) => item.siteStatus === "PUBLISHED").length;
    const suspendedCount = items.filter((item) => item.status === "SUSPENDED").length;

    return {
      kpis: {
        activeCount,
        totalCount: total,
        publishedCount,
        suspendedCount,
      },
      items,
    };
  }

  async listProfessionals() {
    const professionals = await this.prisma.professional.findMany({
      include: {
        owner: { select: { id: true, email: true, name: true } },
        tenants: { select: { id: true, slug: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return professionals.map((item) => ({
      ...presentProfessional(item),
      owner: item.owner,
      workspaces: item.tenants,
    }));
  }

  async getProfessional(id: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        tenants: { include: workspaceWithRelations, orderBy: { name: "asc" } },
      },
    });
    if (!professional) {
      throw new ApiException(API_ERROR_CODES.PROFESSIONAL_NOT_FOUND);
    }

    return {
      ...presentProfessional(professional),
      owner: professional.owner,
      workspaces: professional.tenants.map(presentWorkspace),
    };
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: workspaceWithRelations,
      orderBy: { name: "asc" },
    });
    return tenants.map(presentWorkspace);
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: workspaceWithRelations,
    });
    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }
    return presentWorkspace(tenant);
  }

  async suspend(id: string, reason?: string) {
    const tenant = await this.requireTenant(id);
    if (tenant.status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_ARCHIVED);
    }
    if (tenant.status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Cet espace est déjà suspendu");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id },
        data: {
          status: "SUSPENDED",
          statusBeforeSuspend: tenant.status,
          suspendedAt: new Date(),
          suspendedReason: reason?.trim() || null,
        },
        include: workspaceWithRelations,
      });
      await tx.refreshToken.updateMany({
        where: { tenantId: id, revokedAt: null, audience: "STOREFRONT" },
        data: { revokedAt: new Date() },
      });
      return next;
    });

    return presentWorkspace(updated);
  }

  async reactivate(id: string) {
    const tenant = await this.requireTenant(id);
    if (tenant.status !== "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Seul un espace suspendu peut être réactivé");
    }

    const restored = tenant.statusBeforeSuspend === "DRAFT" ? "DRAFT" : "ACTIVE";
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: restored,
        statusBeforeSuspend: null,
        suspendedAt: null,
        suspendedReason: null,
      },
      include: workspaceWithRelations,
    });
    return presentWorkspace(updated);
  }

  async archive(id: string) {
    const tenant = await this.requireTenant(id);
    if (tenant.status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_ARCHIVED);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tenant.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
        },
        include: workspaceWithRelations,
      });
      await tx.refreshToken.updateMany({
        where: { tenantId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return next;
    });

    return presentWorkspace(updated);
  }

  private async requireTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }
    return tenant;
  }
}

function stageLabel(stage: string) {
  if (stage === "PENDING_PHONE") return "Tél. à confirmer";
  if (stage === "ONBOARDING") return "Inscription";
  if (stage === "ACTIVE") return "Actif";
  if (stage === "SUSPENDED") return "Suspendu";
  return stage;
}

function categoryLabel(category: string) {
  if (category === "BOUTIQUE") return "Boutique";
  if (category === "RESTAURANT") return "Restaurant";
  if (category === "VITRINE") return "Site vitrine";
  return category;
}

function accountStatusLabel(status: string) {
  if (status === "ACTIVE") return "Actif";
  if (status === "SUSPENDED") return "Suspendu";
  if (status === "DRAFT") return "Brouillon";
  if (status === "ARCHIVED") return "Archivé";
  return status;
}

function siteStatusLabel(status: string) {
  if (status === "PUBLISHED") return "Publié";
  if (status === "DRAFT") return "Brouillon";
  if (status === "MAINTENANCE") return "Maintenance";
  if (status === "SUSPENDED") return "Suspendu";
  return status;
}

function planTierLabel(planName: string) {
  const lower = planName.toLowerCase();
  if (lower.includes("business")) return "Business";
  if (lower.includes("pro")) return "Pro";
  if (lower.includes("starter") || lower.includes("découverte") || lower.includes("decouverte")) {
    return "Découverte";
  }
  return planName;
}
