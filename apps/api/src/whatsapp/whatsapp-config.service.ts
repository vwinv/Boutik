import { Injectable } from "@nestjs/common";
import { getPublicOrigin, getWhatsappConfig } from "@boutik/config";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { ModulesService, WHATSAPP_ORDERS_MODULE_SLUG } from "../modules/modules.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantAccessService } from "../professionals/tenant-access.service";
import type { UpsertWhatsappConfigDto } from "./dto/whatsapp.dto";

@Injectable()
export class WhatsappConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly modules: ModulesService,
  ) {}

  async getForWorkspace(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    if (tenant.category !== "BOUTIQUE") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "WhatsApp commande est réservé aux boutiques");
    }
    const moduleActive = await this.modules.isActive(tenantId, WHATSAPP_ORDERS_MODULE_SLUG);
    const config = await this.prisma.tenantWhatsAppConfig.findUnique({ where: { tenantId } });
    return presentConfig(config, moduleActive);
  }

  async upsertForWorkspace(userId: string, tenantId: string, input: UpsertWhatsappConfigDto) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { owner: true });
    if (tenant.category !== "BOUTIQUE") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "WhatsApp commande est réservé aux boutiques");
    }
    const moduleActive = await this.modules.isActive(tenantId, WHATSAPP_ORDERS_MODULE_SLUG);
    if (!moduleActive) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "Activez d’abord le module Commande WhatsApp",
      );
    }

    const existingOther = await this.prisma.tenantWhatsAppConfig.findFirst({
      where: { phoneNumberId: input.phoneNumberId, NOT: { tenantId } },
      select: { tenantId: true },
    });
    if (existingOther) {
      throw new ApiException(
        API_ERROR_CODES.CONFLICT,
        "Ce Phone Number ID est déjà lié à une autre boutique",
      );
    }

    const config = await this.prisma.tenantWhatsAppConfig.upsert({
      where: { tenantId },
      update: {
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone,
        accessToken: input.accessToken,
        businessAccountId: input.businessAccountId,
        isEnabled: input.isEnabled ?? true,
        connectedAt: new Date(),
        lastError: null,
      },
      create: {
        tenantId,
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone,
        accessToken: input.accessToken,
        businessAccountId: input.businessAccountId,
        isEnabled: input.isEnabled ?? true,
        connectedAt: new Date(),
      },
    });

    return presentConfig(config, true);
  }
}

function presentConfig(
  config: {
    phoneNumberId: string;
    displayPhone: string | null;
    accessToken: string;
    businessAccountId: string | null;
    isEnabled: boolean;
    connectedAt: Date | null;
    lastError: string | null;
  } | null,
  moduleActive: boolean,
) {
  const origin = getPublicOrigin().replace(/\/$/, "");
  return {
    moduleActive,
    configured: Boolean(config),
    phoneNumberId: config?.phoneNumberId ?? null,
    displayPhone: config?.displayPhone ?? null,
    businessAccountId: config?.businessAccountId ?? null,
    isEnabled: config?.isEnabled ?? false,
    connectedAt: config?.connectedAt?.toISOString() ?? null,
    lastError: config?.lastError ?? null,
    accessTokenMasked: config ? maskToken(config.accessToken) : null,
    webhookUrl: `${origin}/api/webhooks/whatsapp`,
    verifyTokenHint: getWhatsappConfig().verifyToken ? "Configuré côté serveur (WHATSAPP_VERIFY_TOKEN)" : null,
  };
}

function maskToken(token: string) {
  if (token.length <= 10) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
