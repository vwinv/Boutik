import { Injectable } from "@nestjs/common";
import type { MembershipRole, Prisma } from "@prisma/client";
import { API_ERROR_CODES, subscriptionAccess } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { workspaceWithRelations, type WorkspaceRecord } from "./workspace.presenter";

const MUTATE_ROLES: MembershipRole[] = ["OWNER", "MANAGER"];

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnedProfessional(userId: string, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, ownerUserId: userId },
    });

    if (!professional) {
      throw new ApiException(API_ERROR_CODES.PROFESSIONAL_NOT_FOUND);
    }

    return professional;
  }

  async getWorkspaceForMember(userId: string, tenantId: string, options?: { mutate?: boolean; owner?: boolean }) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        memberships: { some: { userId } },
      },
      include: workspaceWithRelations,
    });

    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }

    const membership = tenant.memberships.find((item) => item.user.id === userId);
    if (!membership) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }

    if (options?.owner && membership.role !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Seul le propriétaire peut effectuer cette action");
    }

    if (options?.mutate) {
      this.assertCanMutate(tenant, membership.role);
      await this.assertSubscriptionAllowsMutation(tenant.id);
    }

    return tenant;
  }

  assertCanMutate(tenant: Pick<WorkspaceRecord, "status">, role: MembershipRole) {
    if (tenant.status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_ARCHIVED);
    }
    if (tenant.status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.TENANT_SUSPENDED);
    }
    if (!MUTATE_ROLES.includes(role)) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }
  }

  private async assertSubscriptionAllowsMutation(tenantId: string) {
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });
    if (!current || current.expiredRestriction !== "READ_ONLY") {
      return;
    }
    if (subscriptionAccess(current.currentPeriodEndsAt, current.graceDays) === "EXPIRED") {
      throw new ApiException(API_ERROR_CODES.SUBSCRIPTION_EXPIRED);
    }
  }

  workspaceWhereForUser(userId: string): Prisma.TenantWhereInput {
    return {
      memberships: { some: { userId } },
      status: { not: "ARCHIVED" },
    };
  }
}
