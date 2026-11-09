import { Injectable } from "@nestjs/common";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { API_ERROR_CODES, type StaffRole } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

const ROLE_LABEL: Record<Exclude<StaffRole, "NONE">, string> = {
  OWNER: "Super admin",
  ADMIN: "Admin",
  SUPPORT: "Support",
  FINANCE: "Finance",
  MODERATION: "Modération",
};

const ROLE_MODULES: Record<Exclude<StaffRole, "NONE">, string[]> = {
  OWNER: [
    "Tableau de bord",
    "Utilisateurs",
    "Professionnels & espaces",
    "Support client",
    "Abonnements",
    "Wallets",
    "Demandes de retrait",
    "Offres",
    "Fonctionnalités",
    "Modèles",
  ],
  ADMIN: [
    "Tableau de bord",
    "Utilisateurs",
    "Professionnels & espaces",
    "Support client",
    "Abonnements",
    "Wallets",
    "Demandes de retrait",
    "Offres",
    "Fonctionnalités",
    "Modèles",
  ],
  SUPPORT: ["Tableau de bord", "Professionnels & espaces", "Support client"],
  FINANCE: ["Tableau de bord", "Abonnements", "Wallets", "Demandes de retrait", "Offres"],
  MODERATION: ["Tableau de bord", "Professionnels & espaces", "Support client", "Modèles"],
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeam() {
    const users = await this.prisma.user.findMany({
      where: { staffRole: { not: "NONE" } },
      orderBy: [{ staffStatus: "asc" }, { createdAt: "asc" }],
    });

    const items = users.map((user) => this.presentStaff(user));
    const total = items.length;
    const activeCount = items.filter((item) => item.status === "ACTIVE").length;
    const twoFaCount = items.filter((item) => item.twoFaEnabled).length;
    const invitedCount = items.filter((item) => item.status === "INVITED").length;

    const roleKeys = ["OWNER", "SUPPORT", "FINANCE", "MODERATION"] as const;
    const roles = roleKeys.map((role) => ({
      key: role,
      label: ROLE_LABEL[role],
      memberCount: items.filter((item) => item.role === role && item.status !== "DISABLED").length,
      modules: ROLE_MODULES[role],
    }));

    return {
      kpis: {
        activeCount,
        totalCount: total,
        twoFaCount,
        invitedCount,
      },
      roles,
      items,
    };
  }

  async inviteStaff(
    actor: RequestUser,
    input: { name: string; email: string; staffRole: Exclude<StaffRole, "NONE" | "ADMIN"> },
  ) {
    if (input.staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Seul un Super admin peut inviter un Super admin");
    }

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (name.length < 2) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez le nom complet");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.staffRole !== "NONE") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Cette adresse fait déjà partie de l’équipe");
    }

    const passwordHash = await hash(randomBytes(24).toString("hex"), 10);
    const now = new Date();

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          staffRole: input.staffRole,
          staffStatus: "INVITED",
          staffInvitedAt: now,
          staffTwoFaEnabled: false,
          passwordHash,
          emailVerifiedAt: null,
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          staffRole: input.staffRole,
          staffStatus: "INVITED",
          staffInvitedAt: now,
          staffTwoFaEnabled: false,
        },
      });
    }

    return this.listTeam();
  }

  async updateStaffRole(actor: RequestUser, userId: string, staffRole: StaffRole) {
    if (actor.id === userId && staffRole === "NONE") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Vous ne pouvez pas retirer votre propre accès");
    }

    const user = await this.requireStaffMember(userId);
    if (user.staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Impossible de modifier un Super admin");
    }
    if (staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Seul un Super admin peut attribuer ce rôle");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        staffRole,
        ...(staffRole === "NONE" ? { staffStatus: "DISABLED" as const } : {}),
      },
    });
    return this.listTeam();
  }

  async deactivate(actor: RequestUser, userId: string) {
    if (actor.id === userId) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Vous ne pouvez pas désactiver votre propre compte");
    }
    const user = await this.requireStaffMember(userId);
    if (user.staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Impossible de désactiver un Super admin");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { staffStatus: "DISABLED" },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.listTeam();
  }

  async reactivate(actor: RequestUser, userId: string) {
    const user = await this.requireStaffMember(userId);
    if (user.staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { staffStatus: "ACTIVE", emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    return this.listTeam();
  }

  async resendInvite(actor: RequestUser, userId: string) {
    const user = await this.requireStaffMember(userId);
    if (user.staffStatus !== "INVITED") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ce membre n’a pas d’invitation en cours");
    }
    if (user.staffRole === "OWNER" && actor.staffRole !== "OWNER") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { staffInvitedAt: new Date() },
    });
    return this.listTeam();
  }

  private async requireStaffMember(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.staffRole === "NONE") {
      throw new ApiException(API_ERROR_CODES.USER_NOT_FOUND);
    }
    return user;
  }

  private presentStaff(user: {
    id: string;
    email: string;
    name: string;
    staffRole: StaffRole;
    staffStatus: "ACTIVE" | "DISABLED" | "INVITED";
    staffTwoFaEnabled: boolean;
    staffInvitedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.staffRole,
      roleLabel: user.staffRole === "NONE" ? "—" : ROLE_LABEL[user.staffRole],
      status: user.staffStatus,
      statusLabel:
        user.staffStatus === "ACTIVE"
          ? "Actif"
          : user.staffStatus === "DISABLED"
            ? "Désactivé"
            : "Invitation envoyée",
      twoFaEnabled: user.staffTwoFaEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      invitedAt: user.staffInvitedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
