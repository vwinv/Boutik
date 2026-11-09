import { readFile } from "node:fs/promises";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { Prisma, type AuthAudience, type TokenPurpose, type User } from "@prisma/client";
import {
  API_ERROR_CODES,
  defaultSitePages,
  nextAvailableSlug,
  siteHost,
  siteUrl,
  workspaceHost,
  workspaceUrl,
  slugifyName,
  type Audience,
} from "@boutik/domain";
import { offeringHasCapability } from "../catalog/effective-capabilities";
import {
  getJwtAccessSecret,
  getJwtAccessTtlSeconds,
  getJwtRefreshTtlSeconds,
  isProduction,
} from "@boutik/config";
import { SubscriptionLifecycleService } from "../billing/subscription-lifecycle.service";
import { ApiException } from "../common/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { CloudinaryMediaStorage } from "../professionals/cloudinary-media.storage";
import { DocumentsStorage } from "../professionals/documents.storage";
import { presentUserRecord } from "../users/user.presenter";
import type { RequestUser } from "./auth.types";
import { NotificationService } from "./notification.service";
import { hashToken, newOpaqueToken, newPhoneCode } from "./tokens";

const PASSWORD_COST = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationService,
    private readonly storage: DocumentsStorage,
    private readonly cloudinary: CloudinaryMediaStorage,
    private readonly subscriptions: SubscriptionLifecycleService,
  ) { }

  async registerPro(input: { name: string; email: string; password: string; phone?: string }) {
    const user = await this.createUser(input);
    if (!user.phone) {
      const verificationToken = await this.issueVerification(user.id, "EMAIL_VERIFY");
      await this.notifications.sendEmailVerification(user.email, verificationToken);
      return this.registrationPayload(user, verificationToken);
    }

    const code = newPhoneCode();
    await this.storeVerification(user.id, "PHONE_VERIFY", code, 15);
    this.notifications.sendPhoneVerification(user.phone, code);
    await this.notifications.sendVerificationCodeEmail(user.email, code);
    const payload = { user: presentUserRecord(user) };
    return isProduction() ? payload : { ...payload, debugCode: code };
  }

  async registerCustomer(input: {
    name: string;
    email: string;
    password: string;
    tenantSlug: string;
    phone?: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug },
      include: { plan: true, selectedOptions: { include: { option: true } } },
    });
    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug: input.tenantSlug });
    }
    assertCustomerTenantAccess(tenant.status);
    if (!offeringHasCapability(tenant, "customers")) {
      throw new ApiException(API_ERROR_CODES.CUSTOMERS_NOT_ALLOWED);
    }

    const user = await this.createUser({
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone,
    });
    await this.prisma.tenantCustomer.create({
      data: { userId: user.id, tenantId: tenant.id },
    });
    // Compte boutique : connexion immédiate (pas de blocage e-mail à l'inscription).
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return this.issueSession(verified, "storefront", tenant.id);
  }

  async loginStaff(email: string, password: string) {
    const user = await this.authenticate(email, password);
    if (user.staffRole === "NONE") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte n'est pas un administrateur MEGA");
    }
    if (user.staffStatus === "DISABLED") {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte staff est désactivé");
    }
    if (user.staffStatus === "INVITED") {
      throw new ApiException(
        API_ERROR_CODES.FORBIDDEN,
        "Acceptez d’abord l’invitation envoyée à votre adresse e-mail",
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueSession(user, "staff");
  }

  async loginPro(email: string, password: string, tenantSlug?: string) {
    const user = await this.authenticatePro(email, password);
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      include: { tenant: true },
    });

    if (tenantSlug) {
      const membership = memberships.find((item) => item.tenant.slug === tenantSlug);
      if (!membership) {
        throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte n'est rattaché à cet espace professionnel");
      }
      assertProTenantAccess(membership.tenant.status);
      return { ...(await this.issueSession(user, "pro", membership.tenantId)), resume: null };
    }

    const usable = memberships.filter((item) => item.tenant.status !== "ARCHIVED");
    if (usable.length > 1) {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "Précisez l'espace professionnel (tenantSlug)",
        { tenants: usable.map((item) => item.tenant.slug) },
      );
    }

    const session = await this.issueSession(user, "pro", usable[0]?.tenantId ?? null);
    return { ...session, resume: usable.length === 0 ? await this.resumeOnboarding(user) : null };
  }

  async switchPro(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiException(API_ERROR_CODES.UNAUTHORIZED);
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    });
    if (!membership) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte n'est pas rattaché à cet espace professionnel");
    }
    assertProTenantAccess(membership.tenant.status);
    return this.issueSession(user, "pro", tenantId);
  }

  async loginCustomer(email: string, password: string, tenantSlug: string) {
    const user = await this.findByPassword(email, password);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { plan: true, selectedOptions: { include: { option: true } } },
    });
    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug: tenantSlug });
    }

    const customer = await this.prisma.tenantCustomer.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    });
    if (!customer) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Ce compte n'est pas client de cet espace");
    }
    assertCustomerTenantAccess(tenant.status);
    if (!offeringHasCapability(tenant, "customers")) {
      throw new ApiException(API_ERROR_CODES.CUSTOMERS_NOT_ALLOWED);
    }

    return this.issueSession(user, "storefront", tenant.id);
  }

  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new ApiException(API_ERROR_CODES.INVALID_TOKEN);
    }

    const audience = fromPrismaAudience(record.audience);
    if (record.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: record.tenantId } });
      if (!tenant) {
        throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
      }
      if (audience === "pro") {
        assertProTenantAccess(tenant.status);
      }
      if (audience === "storefront") {
        assertCustomerTenantAccess(tenant.status);
      }
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(record.user, audience, record.tenantId);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await this.issueVerification(user.id, "PASSWORD_RESET", 60);
      await this.notifications.sendPasswordReset(user.email, token);
      return this.maybeDebug({ sent: true }, token);
    }
    return { sent: true };
  }

  async resetPassword(token: string, password: string) {
    const userId = await this.consumeVerification(token, "PASSWORD_RESET");
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(password, PASSWORD_COST) },
    });
    await this.logoutAll(userId);
    return { reset: true };
  }

  async verifyEmail(token: string) {
    const userId = await this.consumeVerification(token, "EMAIL_VERIFY");
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  async resendEmailVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) {
      return { sent: true };
    }
    const token = await this.issueVerification(user.id, "EMAIL_VERIFY");
    await this.notifications.sendEmailVerification(user.email, token);
    return this.maybeDebug({ sent: true }, token);
  }

  async requestPhoneVerification(userId: string, phone: string) {
    const code = newPhoneCode();
    await this.storeVerification(userId, "PHONE_VERIFY", code, 15);
    this.notifications.sendPhoneVerification(phone, code);
    return this.maybeDebug({ sent: true }, isProduction() ? undefined : code);
  }

  async resendPhoneCode(email: string) {
    const user = await this.unverifiedPhoneUser(email);
    if (!user?.phone) return { sent: true };
    const sent = await this.requestPhoneVerification(user.id, user.phone);
    if ("debugToken" in sent && sent.debugToken) {
      return { sent: true, debugCode: sent.debugToken };
    }
    return { sent: true };
  }

  async sendPhoneCodeByEmail(email: string) {
    const user = await this.unverifiedPhoneUser(email);
    if (!user?.phone) return { sent: true };

    const active = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        purpose: "PHONE_VERIFY",
        consumedAt: null,
        expiresAt: { gt: new Date() },
        otp: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
    const code = active?.otp ?? newPhoneCode();
    if (!active?.otp) {
      await this.storeVerification(user.id, "PHONE_VERIFY", code, 15);
    }
    await this.notifications.sendPhoneCodeByEmail(user.email, code);
    return isProduction() ? { sent: true } : { sent: true, debugCode: code };
  }

  async verifyPhoneByEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phone) {
      throw new ApiException(API_ERROR_CODES.INVALID_TOKEN, "Code invalide ou expiré");
    }
    if (user.phoneVerifiedAt) return { verified: true };
    try {
      return await this.verifyPhone(user.id, code);
    } catch (error) {
      if (error instanceof ApiException && error.apiCode === API_ERROR_CODES.INVALID_TOKEN) {
        throw new ApiException(API_ERROR_CODES.INVALID_TOKEN, "Code invalide ou expiré");
      }
      throw error;
    }
  }

  async saveOnboardingActivity(email: string, category: "VITRINE" | "RESTAURANT" | "BOUTIQUE") {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    if (category !== "BOUTIQUE") {
      throw new ApiException(
        API_ERROR_CODES.BAD_REQUEST,
        "Seule la catégorie Boutique est disponible pour le moment",
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingCategory: category },
    });
    return { category };
  }

  async saveOnboardingBusiness(
    input: {
      email: string;
      businessName: string;
      phone: string;
      description?: string;
      managerLastName?: string;
      managerFirstName?: string;
      professionalEmail?: string;
      address?: string;
      city?: string;
      hours?: string;
      instagramUrl?: string;
      tiktokUrl?: string;
      facebookUrl?: string;
    },
    files: { logo?: Express.Multer.File; cover?: Express.Multer.File },
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    if (!user.onboardingCategory) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Choisissez votre activité avant de continuer");
    }

    const previous = readOnboardingProfile(user.onboardingProfile);
    let logoName = previous.logoName;
    let logoKey = previous.logoKey;
    let coverName = previous.coverName;
    let coverKey = previous.coverKey;

    if (files.logo) {
      assertUpload(files.logo, LOGO_TYPES, "Le logo doit être un PNG, JPG ou SVG");
      if (logoKey) await this.storage.remove(logoKey);
      logoName = files.logo.originalname;
      logoKey = `onboarding/${user.id}/logo/${safeFileName(logoName)}`;
      await this.storage.save(logoKey, files.logo.buffer);
    }
    if (files.cover) {
      assertUpload(files.cover, COVER_TYPES, "La photo de couverture doit être un PNG, JPG ou WEBP");
      if (files.cover.size < 5 * 1024) {
        throw new ApiException(
          API_ERROR_CODES.BAD_REQUEST,
          "La photo de couverture est trop petite (minimum 5 Ko)",
        );
      }
      if (coverKey) await this.storage.remove(coverKey);
      coverName = files.cover.originalname;
      coverKey = `onboarding/${user.id}/cover/${safeFileName(coverName)}`;
      await this.storage.save(coverKey, files.cover.buffer);
    }

    const profile: OnboardingProfile = {
      ...previous,
      businessName: input.businessName,
      phone: input.phone,
      description: input.description,
      managerLastName: input.managerLastName,
      managerFirstName: input.managerFirstName,
      professionalEmail: input.professionalEmail,
      address: input.address,
      city: input.city,
      hours: input.hours,
      instagramUrl: normalizeSocialUrl(input.instagramUrl),
      tiktokUrl: normalizeSocialUrl(input.tiktokUrl),
      facebookUrl: normalizeSocialUrl(input.facebookUrl),
      logoName,
      logoKey,
      coverName,
      coverKey,
    };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingProfile: JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue },
    });

    // Si le site est déjà publié, pousser logo/couverture Activité tout de suite.
    if (files.logo || files.cover) {
      const membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, tenant: { status: { not: "ARCHIVED" } } },
        include: { tenant: { include: { site: true } } },
        orderBy: { createdAt: "asc" },
      });
      const site = membership?.tenant.site;
      if (site) {
        if (logoKey) {
          await this.persistOnboardingSiteLogo(
            membership.tenantId,
            membership.tenant.slug,
            site.id,
            logoKey,
            logoName,
          );
        }
        if (coverKey) {
          await this.persistOnboardingSiteCover(
            membership.tenantId,
            membership.tenant.slug,
            site.id,
            coverKey,
            coverName,
          );
        }
      }
    }

    return {
      saved: true,
      logoName: logoName ?? null,
      coverName: coverName ?? null,
    };
  }

  async saveOnboardingContract(email: string, file?: Express.Multer.File) {
    if (!file || file.mimetype !== "image/png" || file.size < 80) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Signez dans le cadre");
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    const previous = readOnboardingProfile(user.onboardingProfile);
    if (!previous.businessName) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Complétez les informations de votre activité");
    }
    if (previous.contract?.signatureKey) await this.storage.remove(previous.contract.signatureKey);
    const signatureKey = `onboarding/${user.id}/signature/signature.png`;
    await this.storage.save(signatureKey, file.buffer);
    const contract: OnboardingContract = {
      version: "2026-11-02",
      signerName: user.name,
      signatureKey,
      signedAt: new Date().toISOString(),
    };
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingProfile: JSON.parse(JSON.stringify({ ...previous, contract })) as Prisma.InputJsonValue,
      },
    });
    return { signed: true, signedAt: contract.signedAt };
  }

  async saveOnboardingTemplate(input: {
    email: string;
    templateId: "eclat" | "minimal" | "atelier" | "nocturne";
    primary: string;
    secondary: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    const previous = readOnboardingProfile(user.onboardingProfile);
    if (!previous.contract?.signedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Signez le contrat avant de choisir un modèle");
    }
    const theme: OnboardingTheme = {
      templateId: input.templateId,
      primary: input.primary,
      secondary: input.secondary,
      savedAt: new Date().toISOString(),
    };
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingProfile: JSON.parse(JSON.stringify({ ...previous, theme })) as Prisma.InputJsonValue,
      },
    });
    return { saved: true, theme };
  }

  async saveOnboardingContent(input: {
    email: string;
    items: { name: string; priceXof: number; tag?: string; image?: string }[];
  }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    const previous = readOnboardingProfile(user.onboardingProfile);
    if (!previous.contract?.signedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Signez le contrat avant de continuer");
    }
    if (!previous.theme?.templateId) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Choisissez un modèle avant de continuer");
    }
    if (!input.items.length) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ajoutez au moins un élément");
    }
    const content: OnboardingContent = {
      items: input.items.map((item) => ({
        name: item.name.trim(),
        priceXof: item.priceXof,
        tag: item.tag?.trim() || undefined,
        image: item.image?.trim() || undefined,
      })),
      savedAt: new Date().toISOString(),
    };
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingProfile: JSON.parse(JSON.stringify({ ...previous, content })) as Prisma.InputJsonValue,
      },
    });
    return { saved: true, count: content.items.length };
  }

  async saveOnboardingPreview(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    const previous = readOnboardingProfile(user.onboardingProfile);
    if (!previous.content?.items?.length) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ajoutez du contenu avant de continuer");
    }
    const previewedAt = new Date().toISOString();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingProfile: JSON.parse(
          JSON.stringify({ ...previous, previewedAt }),
        ) as Prisma.InputJsonValue,
      },
    });
    return { saved: true, previewedAt };
  }

  async publishOnboarding(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phoneVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Confirmez votre téléphone avant de continuer");
    }
    if (!user.onboardingCategory) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Choisissez une activité avant de publier");
    }
    const previous = readOnboardingProfile(user.onboardingProfile);
    if (!previous.businessName || !previous.content?.items?.length) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Complétez le contenu avant de publier");
    }
    if (!previous.theme?.templateId) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Choisissez un modèle avant de publier");
    }

    const existingMembership = await this.prisma.membership.findFirst({
      where: { userId: user.id, tenant: { status: { not: "ARCHIVED" } } },
      include: { tenant: true },
      orderBy: { createdAt: "asc" },
    });
    if (existingMembership) {
      const colors = themeColors(previous.theme!);
      const publishedAt = new Date();
      const site = await this.prisma.tenantSite.upsert({
        where: { tenantId: existingMembership.tenantId },
        create: {
          tenantId: existingMembership.tenantId,
          status: "PUBLISHED",
          title: previous.businessName!,
          tagline: previous.description || "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.",
          about: previous.description || "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.",
          layoutKey: previous.theme!.templateId,
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          backgroundColor: colors.background,
          textColor: colors.text,
          coverUrl: null,
          email: previous.professionalEmail || user.email,
          phone: previous.phone || user.phone,
          addressLine: previous.address || null,
          city: previous.city || null,
          instagramUrl: previous.instagramUrl || null,
          tiktokUrl: previous.tiktokUrl || null,
          facebookUrl: previous.facebookUrl || null,
          publishedAt,
        },
        update: {
          status: "PUBLISHED",
          title: previous.businessName!,
          tagline: previous.description || undefined,
          about: previous.description || undefined,
          layoutKey: previous.theme!.templateId,
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          backgroundColor: colors.background,
          textColor: colors.text,
          email: previous.professionalEmail || user.email,
          phone: previous.phone || user.phone,
          addressLine: previous.address || null,
          city: previous.city || null,
          instagramUrl: previous.instagramUrl || null,
          tiktokUrl: previous.tiktokUrl || null,
          facebookUrl: previous.facebookUrl || null,
          publishedAt,
        },
      });
      if (previous.logoKey) {
        await this.persistOnboardingSiteLogo(
          existingMembership.tenantId,
          existingMembership.tenant.slug,
          site.id,
          previous.logoKey,
          previous.logoName,
        );
      }
      if (previous.coverKey) {
        await this.persistOnboardingSiteCover(
          existingMembership.tenantId,
          existingMembership.tenant.slug,
          site.id,
          previous.coverKey,
          previous.coverName,
        );
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingProfile: JSON.parse(
            JSON.stringify({
              ...previous,
              published: {
                slug: existingMembership.tenant.slug,
                publishedAt: publishedAt.toISOString(),
              },
            }),
          ) as Prisma.InputJsonValue,
        },
      });
      await this.subscriptions.ensureDefaultFreeSubscription(existingMembership.tenantId);
      const session = await this.issueSession(user, "pro", existingMembership.tenantId);
      const slug = existingMembership.tenant.slug;
      return {
        ...session,
        published: true,
        name: existingMembership.tenant.name,
        slug,
        host: siteHost(slug),
        siteUrl: siteUrl(slug),
        siteHost: siteHost(slug),
        dashboardUrl: workspaceUrl(slug),
        dashboardHost: workspaceHost(slug),
      };
    }

    const plan = await this.prisma.plan.findFirst({
      where: { category: user.onboardingCategory, isActive: true, isDefault: true },
    }) ?? await this.prisma.plan.findFirst({
      where: { category: user.onboardingCategory, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const taken = await this.prisma.tenant.findMany({ select: { slug: true } });
    const base = slugifyName(previous.businessName) || "boutique";
    const slug = nextAvailableSlug(base, taken.map((item) => item.slug));
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Impossible de générer l'adresse du site");
    }

    const colors = themeColors(previous.theme);
    const publishedAt = new Date();
    const published = await this.prisma.$transaction(async (tx) => {
      const professional =
        (await tx.professional.findFirst({ where: { ownerUserId: user.id }, orderBy: { createdAt: "asc" } })) ??
        (await tx.professional.create({
          data: {
            ownerUserId: user.id,
            displayName: previous.businessName!,
            phone: previous.phone || user.phone,
          },
        }));

      const created = await tx.tenant.create({
        data: {
          professionalId: professional.id,
          slug,
          name: previous.businessName!,
          category: user.onboardingCategory!,
          status: "ACTIVE",
          planId: plan?.id,
          planInterval: "MONTHLY",
          description: previous.description || null,
          addressLine: previous.address || null,
          city: previous.city || null,
          contactEmail: previous.professionalEmail || user.email,
          contactPhone: previous.phone || user.phone,
        },
      });

      await tx.membership.create({
        data: { userId: user.id, tenantId: created.id, role: "OWNER" },
      });

      const site = await tx.tenantSite.create({
        data: {
          tenantId: created.id,
          status: "PUBLISHED",
          title: previous.businessName!,
          tagline: previous.description || "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.",
          about: previous.description || "Mode et artisanat d'Afrique de l'Ouest, livrés chez vous.",
          layoutKey: previous.theme!.templateId,
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          backgroundColor: colors.background,
          textColor: colors.text,
          coverUrl: null,
          email: previous.professionalEmail || user.email,
          phone: previous.phone || user.phone,
          addressLine: previous.address || null,
          city: previous.city || null,
          instagramUrl: previous.instagramUrl || null,
          tiktokUrl: previous.tiktokUrl || null,
          facebookUrl: previous.facebookUrl || null,
          publishedAt,
          pages: {
            create: defaultSitePages(previous.businessName!).map((page) => ({
              slug: page.slug,
              title: page.title,
              isHome: page.isHome,
              sortOrder: page.sortOrder,
              sections: {
                create: page.sections.map((section) => ({
                  type: section.type,
                  title: section.title,
                  body: section.body,
                  sortOrder: section.sortOrder,
                })),
              },
            })),
          },
        },
      });

      const categoryIds = new Map<string, string>();
      const pendingPhotos: Array<{ productId: string; image: string }> = [];
      for (const [index, item] of previous.content!.items.entries()) {
        const tag = item.tag?.trim() || "Produits";
        const categorySlug = slugifyName(tag) || `categorie-${index + 1}`;
        let categoryId = categoryIds.get(categorySlug);
        if (!categoryId) {
          const category = await tx.productCategory.create({
            data: {
              tenantId: created.id,
              slug: categorySlug,
              name: tag.includes("·") ? tag.split("·").pop()!.trim() : tag,
              sortOrder: categoryIds.size,
            },
          });
          categoryId = category.id;
          categoryIds.set(categorySlug, categoryId);
        }
        const productSlug = nextAvailableSlug(slugifyName(item.name) || `article-${index + 1}`, []) || `article-${index + 1}`;
        const product = await tx.product.create({
          data: {
            tenantId: created.id,
            categoryId,
            slug: `${productSlug}-${index + 1}`,
            name: item.name,
            priceXof: item.priceXof,
            isActive: true,
            isPublished: true,
            sortOrder: index,
            availability: "IN_STOCK",
          },
        });
        if (item.image?.startsWith("data:image/")) {
          pendingPhotos.push({ productId: product.id, image: item.image });
        }
      }

      return {
        tenant: created,
        siteId: site.id,
        pendingPhotos,
        logoKey: previous.logoKey,
        logoName: previous.logoName,
        coverKey: previous.coverKey,
        coverName: previous.coverName,
      };
    });

    for (const pending of published.pendingPhotos) {
      await this.persistOnboardingProductPhoto(
        published.tenant.id,
        published.tenant.slug,
        pending.productId,
        pending.image,
      );
    }

    if (published.logoKey) {
      await this.persistOnboardingSiteLogo(
        published.tenant.id,
        published.tenant.slug,
        published.siteId,
        published.logoKey,
        published.logoName,
      );
    }
    if (published.coverKey) {
      await this.persistOnboardingSiteCover(
        published.tenant.id,
        published.tenant.slug,
        published.siteId,
        published.coverKey,
        published.coverName,
      );
    }

    const tenant = published.tenant;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingProfile: JSON.parse(
          JSON.stringify({
            ...previous,
            previewedAt: previous.previewedAt ?? publishedAt.toISOString(),
            published: { slug: tenant.slug, publishedAt: publishedAt.toISOString() },
          }),
        ) as Prisma.InputJsonValue,
      },
    });

    await this.subscriptions.ensureDefaultFreeSubscription(tenant.id);

    const session = await this.issueSession(user, "pro", tenant.id);
    return {
      ...session,
      published: true,
      name: tenant.name,
      slug: tenant.slug,
      host: siteHost(tenant.slug),
      siteUrl: siteUrl(tenant.slug),
      siteHost: siteHost(tenant.slug),
      dashboardUrl: workspaceUrl(tenant.slug),
      dashboardHost: workspaceHost(tenant.slug),
    };
  }

  async verifyPhone(userId: string, code: string) {
    await this.consumeVerification(code, "PHONE_VERIFY", userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  private async createUser(input: { name: string; email: string; password: string; phone?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Un compte existe déjà avec cet e-mail");
    }

    return this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hash(input.password, PASSWORD_COST),
      },
    });
  }

  private async unverifiedPhoneUser(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.phone || user.phoneVerifiedAt) return null;
    return user;
  }

  private async authenticate(email: string, password: string) {
    const user = await this.findByPassword(email, password);
    if (!user.emailVerifiedAt) {
      throw new ApiException(API_ERROR_CODES.EMAIL_NOT_VERIFIED);
    }
    return user;
  }

  private async authenticatePro(email: string, password: string) {
    const user = await this.findByPassword(email, password);
    if (!user.emailVerifiedAt && !user.phone) {
      throw new ApiException(API_ERROR_CODES.EMAIL_NOT_VERIFIED);
    }
    return user;
  }

  private async findByPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new ApiException(API_ERROR_CODES.INVALID_CREDENTIALS);
    }
    return user;
  }

  private async resumeOnboarding(user: User) {
    const profile = readOnboardingProfile(user.onboardingProfile);
    let phase: "phone" | "activity" | "info" | "contract" | "template" | "content" | "preview" | "publish" = "phone";
    if (user.phoneVerifiedAt) phase = "activity";
    if (phase === "activity" && user.onboardingCategory) phase = "info";
    if (phase === "info" && profile.businessName) phase = "contract";
    if (phase === "contract" && profile.contract?.signedAt) phase = "template";
    if (phase === "template" && profile.theme?.templateId) phase = "content";
    if (phase === "content" && profile.content?.items?.length) phase = "preview";
    if (phase === "preview" && profile.published?.slug) phase = "publish";
    let signature = "";
    if (profile.contract?.signatureKey) {
      try {
        const bytes = await readFile(this.storage.absolutePath(profile.contract.signatureKey));
        signature = `data:image/png;base64,${bytes.toString("base64")}`;
      } catch {
        signature = "";
      }
    }
    return {
      phase,
      category: user.onboardingCategory,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profile: {
        businessName: profile.businessName ?? "",
        phone: profile.phone ?? "",
        description: profile.description ?? "",
        managerLastName: profile.managerLastName ?? "",
        managerFirstName: profile.managerFirstName ?? "",
        professionalEmail: profile.professionalEmail ?? "",
        address: profile.address ?? "",
        city: profile.city ?? "",
        hours: profile.hours ?? "",
        instagramUrl: profile.instagramUrl ?? "",
        tiktokUrl: profile.tiktokUrl ?? "",
        facebookUrl: profile.facebookUrl ?? "",
        logoName: profile.logoName ?? "",
        coverName: profile.coverName ?? "",
        coverPreview: await this.readOnboardingImageDataUrl(profile.coverKey),
        signature,
        signedAt: profile.contract?.signedAt ?? null,
        templateId: profile.theme?.templateId ?? null,
        primary: profile.theme?.primary ?? "",
        secondary: profile.theme?.secondary ?? "",
        contentItems: profile.content?.items ?? [],
        publishedSlug: profile.published?.slug ?? null,
        publishedAt: profile.published?.publishedAt ?? null,
      },
    };
  }

  private async issueSession(user: User, audience: Audience, tenantId?: string | null) {
    const accessTtl = getJwtAccessTtlSeconds();
    const refreshTtl = getJwtRefreshTtlSeconds();
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, aud: audience, tenantId: tenantId ?? null },
      { secret: getJwtAccessSecret(), expiresIn: accessTtl },
    );
    const refreshToken = newOpaqueToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        audience: toPrismaAudience(audience),
        tenantId: tenantId ?? null,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    const hydrated = await this.hydrate(user, audience, tenantId ?? null);
    return {
      user: hydrated,
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
    };
  }

  async hydrate(user: User, audience: Audience, tenantId: string | null): Promise<RequestUser> {
    const [memberships, customers] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId: user.id },
        include: { tenant: { select: { id: true, slug: true, name: true, status: true, category: true } } },
      }),
      this.prisma.tenantCustomer.findMany({
        where: { userId: user.id },
        include: { tenant: { select: { id: true, slug: true, name: true } } },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      staffRole: user.staffRole,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      audience,
      tenantId,
      memberships: memberships.map((item) => ({
        tenantId: item.tenant.id,
        slug: item.tenant.slug,
        name: item.tenant.name,
        role: item.role,
        status: item.tenant.status,
        category: item.tenant.category,
      })),
      customers: customers.map((item) => ({
        tenantId: item.tenant.id,
        slug: item.tenant.slug,
        name: item.tenant.name,
      })),
    };
  }

  private async issueVerification(userId: string, purpose: TokenPurpose, ttlMinutes = 24 * 60) {
    const token = purpose === "PHONE_VERIFY" ? newPhoneCode() : newOpaqueToken();
    await this.storeVerification(userId, purpose, token, ttlMinutes);
    return token;
  }

  private async storeVerification(userId: string, purpose: TokenPurpose, token: string, ttlMinutes: number) {
    await this.prisma.verificationToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        otp: purpose === "PHONE_VERIFY" ? token : null,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });
  }

  private async consumeVerification(token: string, purpose: TokenPurpose, userId?: string) {
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        purpose,
        consumedAt: null,
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new ApiException(API_ERROR_CODES.INVALID_TOKEN);
    }

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return record.userId;
  }

  private registrationPayload(user: User, verificationToken: string) {
    return this.maybeDebug({ user: presentUserRecord(user) }, verificationToken);
  }

  private maybeDebug<T extends object>(payload: T, debugToken?: string) {
    if (!debugToken || isProduction()) {
      return payload;
    }
    return { ...payload, debugToken };
  }

  private async persistOnboardingSiteLogo(
    tenantId: string,
    shopSlug: string,
    siteId: string,
    logoKey: string,
    logoName?: string,
  ) {
    try {
      const buffer = await readFile(this.storage.absolutePath(logoKey));
      const originalName = logoName?.trim() || logoKey.split("/").pop() || "logo.png";
      const mimeType = imageMimeFromName(originalName);
      const asset = await this.prisma.siteAsset.create({
        data: {
          siteId,
          kind: "LOGO",
          originalName,
          mimeType,
          sizeBytes: buffer.length,
          storageKey: "pending",
        },
      });
      const storageKey = await this.persistImageBuffer({
        tenantId,
        shopSlug,
        siteId,
        assetId: asset.id,
        kind: "site",
        buffer,
        mimeType,
        originalName,
      });
      await this.prisma.siteAsset.update({ where: { id: asset.id }, data: { storageKey } });
      await this.prisma.tenantSite.update({
        where: { id: siteId },
        data: { logoUrl: `asset:${asset.id}` },
      });
    } catch {
      // Logo onboarding optionnel : la publication ne doit pas échouer.
    }
  }

  private async persistOnboardingSiteCover(
    tenantId: string,
    shopSlug: string,
    siteId: string,
    coverKey: string,
    coverName?: string,
  ) {
    try {
      const buffer = await readFile(this.storage.absolutePath(coverKey));
      const originalName = coverName?.trim() || coverKey.split("/").pop() || "cover.jpg";
      const mimeType = imageMimeFromName(originalName);
      const asset = await this.prisma.siteAsset.create({
        data: {
          siteId,
          kind: "COVER",
          originalName,
          mimeType,
          sizeBytes: buffer.length,
          storageKey: "pending",
        },
      });
      const storageKey = await this.persistImageBuffer({
        tenantId,
        shopSlug,
        siteId,
        assetId: asset.id,
        kind: "site",
        buffer,
        mimeType,
        originalName,
      });
      await this.prisma.siteAsset.update({ where: { id: asset.id }, data: { storageKey } });
      await this.prisma.tenantSite.update({
        where: { id: siteId },
        data: { coverUrl: `asset:${asset.id}` },
      });
    } catch {
      // Couverture onboarding optionnelle : la publication ne doit pas échouer.
    }
  }

  private async readOnboardingImageDataUrl(storageKey?: string) {
    if (!storageKey) return "";
    try {
      const buffer = await readFile(this.storage.absolutePath(storageKey));
      const mimeType = imageMimeFromName(storageKey);
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch {
      return "";
    }
  }

  private async persistOnboardingProductPhoto(
    tenantId: string,
    shopSlug: string,
    productId: string,
    image: string,
  ) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(image);
    if (!match) return;
    const mimeType = match[1]!;
    const buffer = Buffer.from(match[2]!, "base64");
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return;
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const originalName = `photo.${extension}`;
    const photo = await this.prisma.productPhoto.create({
      data: {
        productId,
        originalName,
        mimeType,
        sizeBytes: buffer.length,
        storageKey: "pending",
        sortOrder: 0,
      },
    });
    try {
      const storageKey = await this.persistImageBuffer({
        tenantId,
        shopSlug,
        productId,
        photoId: photo.id,
        kind: "product",
        buffer,
        mimeType,
        originalName,
      });
      await this.prisma.productPhoto.update({ where: { id: photo.id }, data: { storageKey } });
    } catch {
      await this.prisma.productPhoto.delete({ where: { id: photo.id } }).catch(() => undefined);
    }
  }

  private async persistImageBuffer(input: {
    tenantId: string;
    shopSlug: string;
    siteId?: string;
    assetId?: string;
    productId?: string;
    photoId?: string;
    kind: "site" | "product";
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }) {
    if (this.cloudinary.isEnabled()) {
      if (input.kind === "site" && input.siteId && input.assetId) {
        const uploaded = await this.cloudinary.uploadSiteAsset({
          shopSlug: input.shopSlug,
          siteId: input.siteId,
          assetId: input.assetId,
          buffer: input.buffer,
          mimeType: input.mimeType,
        });
        return uploaded.storageKey;
      }
      if (input.kind === "product" && input.productId && input.photoId) {
        const uploaded = await this.cloudinary.uploadProductPhoto({
          shopSlug: input.shopSlug,
          productId: input.productId,
          photoId: input.photoId,
          buffer: input.buffer,
          mimeType: input.mimeType,
        });
        return uploaded.storageKey;
      }
    }
    const folder =
      input.kind === "site" && input.siteId
        ? `${input.tenantId}/site/${input.siteId}`
        : `${input.tenantId}/products/${input.productId}`;
    const id = input.assetId || input.photoId || "file";
    const storageKey = this.storage.key(folder, id, input.originalName);
    await this.storage.save(storageKey, input.buffer);
    return storageKey;
  }
}

function assertProTenantAccess(status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED") {
  if (status === "ARCHIVED") {
    throw new ApiException(API_ERROR_CODES.TENANT_ARCHIVED);
  }
}

function assertCustomerTenantAccess(status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED") {
  if (status === "SUSPENDED") {
    throw new ApiException(API_ERROR_CODES.TENANT_SUSPENDED);
  }
  if (status !== "ACTIVE") {
    throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
  }
}

function toPrismaAudience(audience: Audience): AuthAudience {
  if (audience === "staff") {
    return "STAFF";
  }
  if (audience === "pro") {
    return "PRO";
  }
  return "STOREFRONT";
}

function fromPrismaAudience(audience: AuthAudience): Audience {
  if (audience === "STAFF") {
    return "staff";
  }
  if (audience === "PRO") {
    return "pro";
  }
  return "storefront";
}

type OnboardingProfile = {
  businessName: string;
  phone: string;
  description?: string;
  managerLastName?: string;
  managerFirstName?: string;
  professionalEmail?: string;
  address?: string;
  city?: string;
  hours?: string;
  social?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  logoName?: string;
  logoKey?: string;
  coverName?: string;
  coverKey?: string;
  documentName?: string;
  documentKey?: string;
  contract?: OnboardingContract;
  theme?: OnboardingTheme;
  content?: OnboardingContent;
  previewedAt?: string;
  published?: { slug: string; publishedAt: string };
};

type OnboardingContract = {
  version: string;
  signerName: string;
  signatureKey?: string;
  signedAt: string;
};

type OnboardingTheme = {
  templateId: "eclat" | "minimal" | "atelier" | "nocturne";
  primary: string;
  secondary: string;
  savedAt: string;
};

type OnboardingContentItem = {
  name: string;
  priceXof: number;
  tag?: string;
  image?: string;
};

type OnboardingContent = {
  items: OnboardingContentItem[];
  savedAt: string;
};

function themeColors(theme: OnboardingTheme) {
  const backgrounds: Record<OnboardingTheme["templateId"], string> = {
    eclat: "#ffffff",
    minimal: "#ffffff",
    atelier: "#f4efe6",
    nocturne: "#0b0b0f",
  };
  const texts: Record<OnboardingTheme["templateId"], string> = {
    eclat: "#171717",
    minimal: "#171717",
    atelier: "#1c1917",
    nocturne: "#f5f5f5",
  };
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    background: backgrounds[theme.templateId],
    text: texts[theme.templateId],
  };
}

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", ".png", ".jpg", ".jpeg", ".svg"]);
const COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp", ".png", ".jpg", ".jpeg", ".webp"]);

function imageMimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg") || lower.includes("image/svg")) return "image/svg+xml";
  if (lower.endsWith(".webp") || lower.includes("image/webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.includes("image/jpeg")) return "image/jpeg";
  return "image/png";
}

function normalizeSocialUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 240);
  return `https://${trimmed}`.slice(0, 240);
}

function readOnboardingProfile(value: Prisma.JsonValue | null): Partial<OnboardingProfile> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Partial<OnboardingProfile>;
}

function assertUpload(file: Express.Multer.File, allowed: Set<string>, message: string) {
  const extension = file.originalname.includes(".") ? file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase() : "";
  if (!allowed.has(file.mimetype) && !allowed.has(extension)) {
    throw new ApiException(API_ERROR_CODES.BAD_REQUEST, message);
  }
}

function safeFileName(name: string) {
  const base = name.replaceAll("\\", "/").split("/").pop() ?? "fichier";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "");
  return cleaned.slice(0, 80) || "fichier";
}
