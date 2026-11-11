import { Injectable, Logger } from "@nestjs/common";
import { getPublicOrigin, getWhatsappConfig } from "@boutik/config";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { ModulesService, WHATSAPP_ORDERS_MODULE_SLUG } from "../modules/modules.service";
import { PrismaService } from "../prisma/prisma.service";
import { TenantAccessService } from "../professionals/tenant-access.service";
import type { EmbeddedSignupDto, UpdateWhatsappShopDto, UpsertWhatsappConfigDto } from "./dto/whatsapp.dto";
import { WhatsappCloudService } from "./whatsapp-cloud.service";

@Injectable()
export class WhatsappConfigService {
  private readonly logger = new Logger(WhatsappConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly modules: ModulesService,
    private readonly cloud: WhatsappCloudService,
  ) {}

  async getForWorkspace(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    if (tenant.category !== "BOUTIQUE") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "WhatsApp commande est réservé aux boutiques");
    }
    const moduleActive = await this.modules.isActive(tenantId, WHATSAPP_ORDERS_MODULE_SLUG);
    const config = await this.prisma.tenantWhatsAppConfig.findUnique({ where: { tenantId } });
    const recentOrders = config
      ? await this.prisma.order.count({
          where: { tenantId, paymentMethod: "whatsapp" },
        })
      : 0;
    return presentConfig(config, moduleActive, recentOrders);
  }

  async upsertForWorkspace(userId: string, tenantId: string, input: UpsertWhatsappConfigDto) {
    await this.requireBoutiqueModule(userId, tenantId, { owner: true });
    await this.assertPhoneAvailable(input.phoneNumberId, tenantId);

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

  async updateShopSettings(userId: string, tenantId: string, input: UpdateWhatsappShopDto) {
    await this.requireBoutiqueModule(userId, tenantId, { owner: true });
    const existing = await this.prisma.tenantWhatsAppConfig.findUnique({ where: { tenantId } });
    if (!existing) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Connectez d’abord WhatsApp à votre boutique");
    }
    const nextPickup = input.allowPickup ?? existing.allowPickup;
    const nextDelivery = input.allowDelivery ?? existing.allowDelivery;
    if (!nextPickup && !nextDelivery) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Activez au moins un mode : retrait ou livraison");
    }

    const config = await this.prisma.tenantWhatsAppConfig.update({
      where: { tenantId },
      data: {
        shopOpen: input.shopOpen,
        allowPickup: input.allowPickup,
        allowDelivery: input.allowDelivery,
        isEnabled: input.isEnabled,
        welcomeMessage: normalizeNullable(input.welcomeMessage),
        closedMessage: normalizeNullable(input.closedMessage),
        openTime: normalizeNullable(input.openTime),
        closeTime: normalizeNullable(input.closeTime),
      },
    });
    return presentConfig(config, true);
  }

  async completeEmbeddedSignup(userId: string, tenantId: string, input: EmbeddedSignupDto) {
    await this.requireBoutiqueModule(userId, tenantId, { owner: true });
    const wa = getWhatsappConfig();
    if (!wa.appId || !wa.appSecret || !wa.embeddedSignupConfigId) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "La connexion Meta one-click n’est pas encore activée sur Boutik. Utilisez la connexion guidée.",
      );
    }

    const accessToken = await this.exchangeEmbeddedCode(input.code);

    let phoneNumberId = input.phoneNumberId?.trim() || "";
    let wabaId = input.wabaId?.trim() || "";
    let displayPhone = input.displayPhone;

    if (!wabaId) {
      const discovered = await this.cloud.discoverWabaIdsFromToken({ accessToken });
      if (discovered.ok && discovered.wabaIds[0]) {
        wabaId = discovered.wabaIds[0];
      } else if (!phoneNumberId) {
        this.logger.warn(
          { tenantId, error: discovered.error },
          "Impossible de découvrir le WABA depuis le token Embedded Signup",
        );
      }
    }

    if (wabaId) {
      const subscribed = await this.cloud.subscribeWaba({ wabaId, accessToken });
      if (!subscribed.ok) {
        this.logger.warn(
          { tenantId, wabaId, error: subscribed.error },
          "WABA non abonné aux webhooks après Embedded Signup",
        );
      }
    }

    if (!phoneNumberId && wabaId) {
      const listed = await this.cloud.listWabaPhoneNumbers({ wabaId, accessToken });
      if (!listed.ok || listed.phones.length === 0) {
        throw new ApiException(
          API_ERROR_CODES.BAD_REQUEST,
          listed.error ||
            "Meta n’a renvoyé aucun numéro WhatsApp pour ce compte. Ajoutez un numéro dans Meta Business, puis réessayez.",
        );
      }
      phoneNumberId = listed.phones[0]!.id;
      displayPhone = displayPhone || listed.phones[0]!.displayPhone;
    }

    if (!phoneNumberId) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "Meta n’a pas renvoyé l’identifiant du numéro WhatsApp. Vérifiez WHATSAPP_APP_SECRET (App Secret Meta, pas le mot de passe Facebook), puis recommencez la connexion jusqu’au bout.",
      );
    }

    await this.assertPhoneAvailable(phoneNumberId, tenantId);

    const verified = await this.cloud.verifyCredentials({
      phoneNumberId,
      accessToken,
    });
    displayPhone = displayPhone || verified.displayPhone || undefined;

    const config = await this.prisma.tenantWhatsAppConfig.upsert({
      where: { tenantId },
      update: {
        phoneNumberId,
        displayPhone,
        accessToken,
        businessAccountId: wabaId || undefined,
        isEnabled: true,
        shopOpen: true,
        connectedAt: new Date(),
        lastError: verified.ok ? null : verified.error || "Vérification Meta partielle",
      },
      create: {
        tenantId,
        phoneNumberId,
        displayPhone,
        accessToken,
        businessAccountId: wabaId || undefined,
        isEnabled: true,
        shopOpen: true,
        connectedAt: new Date(),
        lastError: verified.ok ? null : verified.error || "Vérification Meta partielle",
      },
    });

    return presentConfig(config, true);
  }

  async testConnection(userId: string, tenantId: string) {
    await this.requireBoutiqueModule(userId, tenantId, { owner: true });
    const config = await this.prisma.tenantWhatsAppConfig.findUnique({ where: { tenantId } });
    if (!config) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "WhatsApp n’est pas encore connecté");
    }
    const result = await this.cloud.verifyCredentials({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
    });
    if (!result.ok) {
      await this.prisma.tenantWhatsAppConfig.update({
        where: { tenantId },
        data: { lastError: result.error || "Connexion Meta invalide" },
      });
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, result.error || "Connexion Meta invalide");
    }
    const updated = await this.prisma.tenantWhatsAppConfig.update({
      where: { tenantId },
      data: {
        lastError: null,
        displayPhone: result.displayPhone || config.displayPhone,
      },
    });
    return presentConfig(updated, true);
  }

  async disconnect(userId: string, tenantId: string) {
    await this.requireBoutiqueModule(userId, tenantId, { owner: true });
    await this.prisma.tenantWhatsAppConfig.deleteMany({ where: { tenantId } });
    return presentConfig(null, true);
  }

  private async requireBoutiqueModule(
    userId: string,
    tenantId: string,
    opts?: { owner?: boolean },
  ) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, opts);
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
    return tenant;
  }

  private async assertPhoneAvailable(phoneNumberId: string, tenantId: string) {
    const existingOther = await this.prisma.tenantWhatsAppConfig.findFirst({
      where: { phoneNumberId, NOT: { tenantId } },
      select: { tenantId: true },
    });
    if (existingOther) {
      throw new ApiException(
        API_ERROR_CODES.CONFLICT,
        "Ce Phone Number ID est déjà lié à une autre boutique",
      );
    }
  }

  private async exchangeEmbeddedCode(code: string) {
    const wa = getWhatsappConfig();
    // FB.login() (JS SDK) enregistre ce redirect_uri interne pendant le dialog OAuth.
    // L’échanger sans la même valeur → error_subcode 36008.
    const jsSdkRedirectUri = "https://www.facebook.com/connect/login_success.html";
    const url = new URL(`${wa.graphBaseUrl}/${wa.apiVersion}/oauth/access_token`);
    url.searchParams.set("client_id", wa.appId!);
    url.searchParams.set("client_secret", wa.appSecret!);
    url.searchParams.set("code", code);
    url.searchParams.set("redirect_uri", jsSdkRedirectUri);
    try {
      const response = await fetch(url.toString(), { method: "GET" });
      const json = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        error?: { message?: string; error_subcode?: number };
      };
      if (!response.ok || !json.access_token) {
        this.logger.error({ json }, "Échange code Embedded Signup échoué");
        const metaMessage = json.error?.message || "Impossible d’obtenir le token Meta";
        const hint = /app secret|client_secret|invalid client|client id/i.test(metaMessage)
          ? " Vérifiez WHATSAPP_APP_SECRET dans .env (App Settings → Basic → App Secret)."
          : /domaine|domain/i.test(metaMessage)
            ? " Ajoutez le domaine du tunnel (ex. xxx.trycloudflare.com) dans App Domains + Allowed Domains for the JavaScript SDK."
            : /redirect_uri/i.test(metaMessage)
              ? ` Ajoutez ${jsSdkRedirectUri} dans Valid OAuth Redirect URIs (Meta → Facebook Login → Settings).`
              : "";
        throw new ApiException(API_ERROR_CODES.BAD_REQUEST, `${metaMessage}${hint}`);
      }
      const longLived = await this.exchangeLongLivedToken(json.access_token);
      return longLived || json.access_token;
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Échange token Meta impossible");
    }
  }

  private async exchangeLongLivedToken(shortLived: string) {
    const wa = getWhatsappConfig();
    try {
      const url = new URL(`${wa.graphBaseUrl}/${wa.apiVersion}/oauth/access_token`);
      url.searchParams.set("grant_type", "fb_exchange_token");
      url.searchParams.set("client_id", wa.appId!);
      url.searchParams.set("client_secret", wa.appSecret!);
      url.searchParams.set("fb_exchange_token", shortLived);
      const response = await fetch(url.toString());
      const json = (await response.json()) as { access_token?: string };
      if (!response.ok || !json.access_token) return null;
      return json.access_token;
    } catch {
      return null;
    }
  }
}

function normalizeNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return value;
}

function presentConfig(
  config: {
    phoneNumberId: string;
    displayPhone: string | null;
    accessToken: string;
    businessAccountId: string | null;
    isEnabled: boolean;
    shopOpen: boolean;
    allowPickup: boolean;
    allowDelivery: boolean;
    welcomeMessage: string | null;
    closedMessage: string | null;
    openTime: string | null;
    closeTime: string | null;
    connectedAt: Date | null;
    lastInboundAt: Date | null;
    lastError: string | null;
  } | null,
  moduleActive: boolean,
  ordersCount = 0,
) {
  const origin = getPublicOrigin().replace(/\/$/, "");
  const wa = getWhatsappConfig();
  const status = !moduleActive
    ? "module_off"
    : !config
      ? "not_connected"
      : config.lastError
        ? "error"
        : !config.isEnabled || !config.shopOpen
          ? "paused"
          : "live";

  return {
    moduleActive,
    configured: Boolean(config),
    status,
    phoneNumberId: config?.phoneNumberId ?? null,
    displayPhone: config?.displayPhone ?? null,
    businessAccountId: config?.businessAccountId ?? null,
    isEnabled: config?.isEnabled ?? false,
    shopOpen: config?.shopOpen ?? true,
    allowPickup: config?.allowPickup ?? true,
    allowDelivery: config?.allowDelivery ?? true,
    welcomeMessage: config?.welcomeMessage ?? null,
    closedMessage: config?.closedMessage ?? null,
    openTime: config?.openTime ?? null,
    closeTime: config?.closeTime ?? null,
    connectedAt: config?.connectedAt?.toISOString() ?? null,
    lastInboundAt: config?.lastInboundAt?.toISOString() ?? null,
    lastError: config?.lastError ?? null,
    accessTokenMasked: config ? maskToken(config.accessToken) : null,
    ordersCount,
    webhookUrl: `${origin}/api/webhooks/whatsapp`,
    verifyTokenHint: wa.verifyToken ? "Configuré côté serveur (WHATSAPP_VERIFY_TOKEN)" : null,
    embeddedSignup: {
      available: Boolean(wa.appId && wa.appSecret && wa.embeddedSignupConfigId),
      appId: wa.appId || null,
      configId: wa.embeddedSignupConfigId || null,
      graphVersion: wa.apiVersion,
      missing: [
        !wa.appId ? "WHATSAPP_APP_ID" : null,
        !wa.appSecret ? "WHATSAPP_APP_SECRET" : null,
        !wa.embeddedSignupConfigId ? "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID" : null,
      ].filter(Boolean) as string[],
    },
  };
}

function maskToken(token: string) {
  if (token.length <= 10) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
