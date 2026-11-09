import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { presentProfessional } from "../professionals/professional.presenter";
import { presentWorkspace, workspaceWithRelations } from "../professionals/workspace.presenter";

@Injectable()
export class AdminTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste admin « Professionnels & espaces » — pas de file d’attente de validation Boutik. */
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
