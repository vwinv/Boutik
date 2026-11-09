import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { presentProfessional } from "./professional.presenter";
import { TenantAccessService } from "./tenant-access.service";
import { presentWorkspace, workspaceWithRelations } from "./workspace.presenter";
import type { CreateProfessionalDto } from "./dto/create-professional.dto";
import type { UpdateProfessionalDto } from "./dto/update-professional.dto";

@Injectable()
export class ProfessionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async create(userId: string, input: CreateProfessionalDto) {
    const professional = await this.prisma.professional.create({
      data: {
        ownerUserId: userId,
        displayName: input.displayName,
        jobTitle: input.jobTitle,
        bio: input.bio,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
      },
    });
    return presentProfessional(professional);
  }

  async listMine(userId: string) {
    const professionals = await this.prisma.professional.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" },
    });
    return professionals.map(presentProfessional);
  }

  async getMine(userId: string, professionalId: string) {
    const professional = await this.access.getOwnedProfessional(userId, professionalId);
    const workspaces = await this.prisma.tenant.findMany({
      where: {
        professionalId: professional.id,
        memberships: { some: { userId } },
        status: { not: "ARCHIVED" },
      },
      include: workspaceWithRelations,
      orderBy: { name: "asc" },
    });

    return {
      ...presentProfessional(professional),
      workspaces: workspaces.map(presentWorkspace),
    };
  }

  async updateMine(userId: string, professionalId: string, input: UpdateProfessionalDto) {
    await this.access.getOwnedProfessional(userId, professionalId);
    const professional = await this.prisma.professional.update({
      where: { id: professionalId },
      data: {
        displayName: input.displayName,
        jobTitle: input.jobTitle,
        bio: input.bio,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
      },
    });
    return presentProfessional(professional);
  }
}
