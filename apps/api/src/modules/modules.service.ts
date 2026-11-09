import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { TenantAccessService } from "../professionals/tenant-access.service";
import type { SetTenantModuleDto, UpdatePlatformModuleDto } from "./dto/modules.dto";
import { presentPlatformModule } from "./modules.presenter";

export const SMS_MODULE_SLUG = "sms";
export const WHATSAPP_ORDERS_MODULE_SLUG = "whatsapp-orders";

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async listForAdmin() {
    const rows = await this.prisma.platformModule.findMany({
      include: { activations: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return {
      items: rows.map((row) => presentPlatformModule(row)),
    };
  }

  async updateForAdmin(moduleId: string, input: UpdatePlatformModuleDto) {
    const existing = await this.prisma.platformModule.findUnique({ where: { id: moduleId } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Module introuvable");
    }
    const updated = await this.prisma.platformModule.update({
      where: { id: moduleId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        amountXof: input.amountXof,
        isActive: input.isActive,
        categories: input.categories,
        sortOrder: input.sortOrder,
      },
      include: { activations: true },
    });
    return presentPlatformModule(updated);
  }

  async listForWorkspace(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    const rows = await this.prisma.platformModule.findMany({
      where: {
        isActive: true,
        OR: [{ categories: { isEmpty: true } }, { categories: { has: tenant.category } }],
      },
      include: {
        activations: { where: { tenantId } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return {
      items: rows.map((row) =>
        presentPlatformModule(row, {
          tenantCategory: tenant.category,
          active: row.activations.length > 0,
        }),
      ),
    };
  }

  async setForWorkspace(userId: string, tenantId: string, moduleId: string, input: SetTenantModuleDto) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { owner: true });
    const module = await this.prisma.platformModule.findFirst({
      where: {
        id: moduleId,
        isActive: true,
        OR: [{ categories: { isEmpty: true } }, { categories: { has: tenant.category } }],
      },
    });
    if (!module) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Module indisponible pour cet espace");
    }

    if (input.active) {
      await this.prisma.tenantModule.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId } },
        update: {},
        create: { tenantId, moduleId },
      });
      if (module.slug === SMS_MODULE_SLUG && tenant.category === "BOUTIQUE") {
        await this.prisma.orderSettings.upsert({
          where: { tenantId },
          update: { notifySms: true },
          create: { tenantId, notifySms: true, freeDeliveryFromXof: 20000 },
        });
      }
    } else {
      await this.prisma.tenantModule.deleteMany({ where: { tenantId, moduleId } });
      if (module.slug === SMS_MODULE_SLUG) {
        await this.prisma.orderSettings.updateMany({
          where: { tenantId },
          data: { notifySms: false },
        });
      }
    }

    return this.listForWorkspace(userId, tenantId);
  }

  async isActive(tenantId: string, slug: string) {
    const row = await this.prisma.tenantModule.findFirst({
      where: {
        tenantId,
        module: { slug, isActive: true },
      },
      select: { tenantId: true },
    });
    return Boolean(row);
  }

  async monthlyModulesAmount(tenantId: string) {
    const rows = await this.prisma.tenantModule.findMany({
      where: { tenantId, module: { isActive: true } },
      include: { module: true },
    });
    return rows.reduce((sum, row) => sum + row.module.amountXof, 0);
  }
}
