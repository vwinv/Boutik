import { Injectable, StreamableFile } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  API_ERROR_CODES,
  defaultOpeningHours,
  defaultSitePages,
  isPublicSlug,
  nextAvailableSlug,
  sectionCapability,
  sitePublicStatus,
  slugifyName,
  tenantSlugFromHost,
} from "@boutik/domain";
import type { Capability, SiteVisualKind } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { assertOfferingCapability } from "../catalog/effective-capabilities";
import { PrismaService } from "../prisma/prisma.service";
import { CloudinaryMediaStorage } from "../professionals/cloudinary-media.storage";
import { DocumentsStorage } from "../professionals/documents.storage";
import { TenantAccessService } from "../professionals/tenant-access.service";
import { workspaceWithRelations, type WorkspaceRecord } from "../professionals/workspace.presenter";
import type { ReorderIdsDto } from "./dto/site-params.dto";
import type {
  CreatePageDto,
  CreateSectionDto,
  CreateSiteDto,
  SuspendSiteDto,
  UpdateSiteContactDto,
  UpdateSiteDraftDto,
  UpdateSiteGeneralDto,
  UpdateSiteHoursDto,
  UpdateSiteSeoDto,
  UpdateSiteSocialDto,
  UpdateSiteThemeDto,
  UpsertPageDto,
  UpsertSectionDto,
} from "./dto/update-site.dto";
import {
  missingPublishFields,
  presentSite,
  sitePagesInclude,
  type SiteRecord,
} from "./site.presenter";

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);

const VISUAL_FIELD: Record<SiteVisualKind, "logoUrl" | "coverUrl" | "faviconUrl" | "bannerUrl"> = {
  logo: "logoUrl",
  cover: "coverUrl",
  favicon: "faviconUrl",
  banner: "bannerUrl",
};

const VISUAL_KIND: Record<SiteVisualKind, "LOGO" | "COVER" | "FAVICON" | "BANNER"> = {
  logo: "LOGO",
  cover: "COVER",
  favicon: "FAVICON",
  banner: "BANNER",
};

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly storage: DocumentsStorage,
    private readonly cloudinary: CloudinaryMediaStorage,
  ) {}

  async suggestSlug(input: { name?: string; slug?: string }) {
    const requested = input.slug ?? slugifyName(input.name ?? "");
    if (!requested || (input.slug ? !isPublicSlug(input.slug) : !isPublicSlug(requested))) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez un nom ou un slug valide");
    }

    const base = requested;

    const taken = await this.takenSlugs(base);
    const available = !taken.has(base);
    const suggestion = available ? base : nextAvailableSlug(base, taken);
    return {
      slug: input.slug ?? suggestion,
      available: input.slug ? available : Boolean(suggestion) && !taken.has(suggestion),
      suggestion: suggestion || null,
    };
  }

  async resolve(input: { slug?: string; host?: string }) {
    const slug = input.slug?.trim().toLowerCase() || tenantSlugFromHost(input.host);
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un slug ou un sous-domaine");
    }

    const tenant = await this.loadTenantBySlug(slug);
    if (!tenant?.site) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }

    const status = sitePublicStatus(tenant.status, tenant.site.status);
    if (status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug });
    }
    if (status === "SUSPENDED") {
      return presentSite(tenant, tenant.site, { publicOnly: true });
    }
    if (status !== "PUBLISHED") {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }

    return presentSite(tenant, tenant.site, { publicOnly: true });
  }

  async create(userId: string, tenantId: string, input: CreateSiteDto) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
    if (tenant.site) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Un site existe déjà pour cet espace");
    }

    if (input.slug && input.slug !== tenant.slug) {
      await this.assertSlugAvailable(input.slug, tenant.id);
    }

    const title = input.title?.trim() || tenant.name;
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.slug && input.slug !== tenant.slug) {
        await tx.tenant.update({ where: { id: tenant.id }, data: { slug: input.slug } });
      }

      const site = await tx.tenantSite.create({
        data: {
          tenantId: tenant.id,
          title,
          tagline: input.tagline ?? tenant.description,
          about: input.about ?? tenant.description,
          email: tenant.contactEmail,
          phone: tenant.contactPhone,
          addressLine: tenant.addressLine,
          city: tenant.city,
          pages: {
            create: defaultSitePages(title).map((page) => ({
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
          hours: {
            create: defaultOpeningHours(),
          },
        },
        include: sitePagesInclude,
      });

      return site;
    });

    const updated = await this.loadTenantById(tenant.id);
    return presentSite(updated, created);
  }

  async getMine(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return presentSite(tenant, await this.requireSite(tenant));
  }

  async preview(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    return presentSite(tenant, await this.requireSite(tenant));
  }

  async updateGeneral(userId: string, tenantId: string, input: UpdateSiteGeneralDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    return this.persistDraft(tenant, { general: input });
  }

  async updateTheme(userId: string, tenantId: string, input: UpdateSiteThemeDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "theme");
    return this.persistDraft(tenant, { theme: input });
  }

  async updateContact(userId: string, tenantId: string, input: UpdateSiteContactDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "contact");
    return this.persistDraft(tenant, { contact: input });
  }

  async updateSocial(userId: string, tenantId: string, input: UpdateSiteSocialDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "contact");
    return this.persistDraft(tenant, { social: input });
  }

  async updateHours(userId: string, tenantId: string, input: UpdateSiteHoursDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "hours");
    return this.persistDraft(tenant, { hours: input });
  }

  async updateSeo(userId: string, tenantId: string, input: UpdateSiteSeoDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "seo");
    return this.persistDraft(tenant, { seo: input });
  }

  async saveDraft(userId: string, tenantId: string, input: UpdateSiteDraftDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    return this.persistDraft(tenant, input);
  }

  private async persistDraft(tenant: WorkspaceRecord, input: UpdateSiteDraftDto) {
    const site = await this.requireSite(tenant);

    if (input.theme) {
      this.assertCapability(tenant, "theme");
    }
    if (input.contact) {
      this.assertCapability(tenant, "contact");
    }
    if (input.seo) {
      this.assertCapability(tenant, "seo");
    }
    if (input.social) {
      this.assertCapability(tenant, "contact");
    }
    if (input.hours) {
      this.assertCapability(tenant, "hours");
    }
    if (input.general?.slug && input.general.slug !== tenant.slug) {
      await this.assertSlugAvailable(input.general.slug, tenant.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.general?.slug && input.general.slug !== tenant.slug) {
        await tx.tenant.update({ where: { id: tenant.id }, data: { slug: input.general.slug } });
      }
      if (input.hours) {
        await this.writeHours(tx, site.id, input.hours);
      }

      return tx.tenantSite.update({
        where: { id: site.id },
        data: {
          title: input.general?.title,
          tagline: input.general?.tagline,
          about: input.general?.about,
          ...input.theme,
          ...input.contact,
          ...input.social,
          ...input.seo,
        },
        include: sitePagesInclude,
      });
    });

    return presentSite(await this.loadTenantById(tenant.id), updated);
  }

  async publish(userId: string, tenantId: string) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    const site = await this.requireSite(tenant);
    const missing = missingPublishFields(site, site.pages);
    if (missing.length > 0) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_READY, undefined, { missing });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (tenant.status === "DRAFT") {
        await tx.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
      }
      return tx.tenantSite.update({
        where: { id: site.id },
        data: {
          status: "PUBLISHED",
          publishedAt: site.publishedAt ?? new Date(),
          unpublishedAt: null,
          suspendedAt: null,
          suspendedReason: null,
        },
        include: sitePagesInclude,
      });
    });

    return presentSite(await this.loadTenantById(tenant.id), updated);
  }

  async unpublish(userId: string, tenantId: string) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    const site = await this.requireSite(tenant);
    if (site.status !== "PUBLISHED") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Seul un site publié peut être dépublié");
    }

    const updated = await this.prisma.tenantSite.update({
      where: { id: site.id },
      data: { status: "DRAFT", unpublishedAt: new Date() },
      include: sitePagesInclude,
    });
    return presentSite(await this.loadTenantById(tenant.id), updated);
  }

  async suspend(userId: string, tenantId: string, input: SuspendSiteDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    const site = await this.requireSite(tenant);
    if (site.status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Ce site est déjà suspendu");
    }

    const updated = await this.prisma.tenantSite.update({
      where: { id: site.id },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendedReason: input.reason ?? null,
      },
      include: sitePagesInclude,
    });
    return presentSite(await this.loadTenantById(tenant.id), updated);
  }

  async listPages(userId: string, tenantId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    return presentSite(tenant, site).pages;
  }

  async getPage(userId: string, tenantId: string, pageId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const page = presentSite(tenant, site).pages.find((item) => item.id === pageId);
    if (!page) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }
    return page;
  }

  async reorderPages(userId: string, tenantId: string, input: ReorderIdsDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const known = new Set(site.pages.map((page) => page.id));
    if (input.ids.some((id) => !known.has(id))) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }
    await this.prisma.$transaction(
      input.ids.map((id, index) => this.prisma.sitePage.update({ where: { id }, data: { sortOrder: index } })),
    );
    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id)).pages;
  }

  async createPage(userId: string, tenantId: string, input: CreatePageDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);

    const created = await this.prisma.$transaction(async (tx) => {
      if (input.isHome) {
        await tx.sitePage.updateMany({ where: { siteId: site.id }, data: { isHome: false } });
      }
      return tx.sitePage.create({
        data: {
          siteId: site.id,
          slug: input.slug,
          title: input.title,
          isHome: input.isHome ?? false,
          isVisible: input.isVisible ?? true,
          sortOrder: input.sortOrder ?? site.pages.length,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
        },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id)).pages.find(
      (page) => page.id === created.id,
    );
  }

  async updatePage(userId: string, tenantId: string, pageId: string, input: UpsertPageDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }
    if (page.isHome && input.isHome === false) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Le site doit conserver une page d'accueil");
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.isHome) {
        await tx.sitePage.updateMany({ where: { siteId: site.id, id: { not: page.id } }, data: { isHome: false } });
      }
      await tx.sitePage.update({
        where: { id: page.id },
        data: {
          slug: input.slug,
          title: input.title,
          isHome: input.isHome,
          isVisible: input.isVisible,
          sortOrder: input.sortOrder,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
        },
      });
    });

    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id)).pages.find(
      (item) => item.id === pageId,
    );
  }

  async removePage(userId: string, tenantId: string, pageId: string) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }
    if (page.isHome) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Impossible de supprimer la page d'accueil");
    }
    await this.prisma.sitePage.delete({ where: { id: page.id } });
    return { deleted: true };
  }

  async createSection(userId: string, tenantId: string, pageId: string, input: CreateSectionDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, sectionCapability(input.type));
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }

    const created = await this.prisma.siteSection.create({
      data: {
        pageId: page.id,
        type: input.type,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder ?? page.sections.length,
        isVisible: input.isVisible ?? true,
      },
    });

    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id))
      .pages.find((item) => item.id === pageId)
      ?.sections.find((item) => item.id === created.id);
  }

  async updateSection(userId: string, tenantId: string, pageId: string, sectionId: string, input: UpsertSectionDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    const section = page?.sections.find((item) => item.id === sectionId);
    if (!page || !section) {
      throw new ApiException(API_ERROR_CODES.SECTION_NOT_FOUND);
    }
    this.assertCapability(tenant, sectionCapability(input.type ?? section.type));

    await this.prisma.siteSection.update({
      where: { id: section.id },
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder,
        isVisible: input.isVisible,
      },
    });

    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id))
      .pages.find((item) => item.id === pageId)
      ?.sections.find((item) => item.id === sectionId);
  }

  async reorderSections(userId: string, tenantId: string, pageId: string, input: ReorderIdsDto) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new ApiException(API_ERROR_CODES.PAGE_NOT_FOUND);
    }
    const known = new Set(page.sections.map((section) => section.id));
    if (input.ids.some((id) => !known.has(id))) {
      throw new ApiException(API_ERROR_CODES.SECTION_NOT_FOUND);
    }
    await this.prisma.$transaction(
      input.ids.map((id, index) => this.prisma.siteSection.update({ where: { id }, data: { sortOrder: index } })),
    );
    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id)).pages.find(
      (item) => item.id === pageId,
    )?.sections;
  }

  async uploadVisual(
    userId: string,
    tenantId: string,
    kind: SiteVisualKind,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    alt?: string | null,
  ) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "theme");
    const site = await this.requireSite(tenant);
    const asset = await this.saveAsset(tenant.id, tenant.slug, site.id, VISUAL_KIND[kind], file, alt);
    const updated = await this.prisma.tenantSite.update({
      where: { id: site.id },
      data: { [VISUAL_FIELD[kind]]: `asset:${asset.id}` },
      include: sitePagesInclude,
    });
    return presentSite(await this.loadTenantById(tenant.id), updated);
  }

  async uploadSectionImage(
    userId: string,
    tenantId: string,
    pageId: string,
    sectionId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    alt?: string | null,
  ) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    const site = await this.requireSite(tenant);
    const page = site.pages.find((item) => item.id === pageId);
    const section = page?.sections.find((item) => item.id === sectionId);
    if (!page || !section) {
      throw new ApiException(API_ERROR_CODES.SECTION_NOT_FOUND);
    }
    this.assertCapability(tenant, sectionCapability(section.type));
    const asset = await this.saveAsset(tenant.id, tenant.slug, site.id, "SECTION", file, alt, section.id);
    await this.prisma.siteSection.update({
      where: { id: section.id },
      data: { imageUrl: `asset:${asset.id}` },
    });
    return presentSite(await this.loadTenantById(tenant.id), await this.requireSiteById(site.id))
      .pages.find((item) => item.id === pageId)
      ?.sections.find((item) => item.id === sectionId);
  }

  async downloadOwnedAsset(userId: string, tenantId: string, assetId: string) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId);
    const site = await this.requireSite(tenant);
    const asset = await this.prisma.siteAsset.findFirst({ where: { id: assetId, siteId: site.id } });
    if (!asset || asset.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Visuel introuvable");
    }
    const remote = this.cloudinary.publicUrl(asset.storageKey);
    if (remote) {
      return { kind: "redirect" as const, url: remote };
    }
    return { kind: "file" as const, file: this.streamAsset(asset) };
  }

  async downloadPublicAsset(input: { slug?: string; host?: string }, assetId: string) {
    const slug = input.slug?.trim().toLowerCase() || tenantSlugFromHost(input.host);
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un slug ou un sous-domaine");
    }
    const tenant = await this.loadTenantBySlug(slug);
    if (!tenant?.site) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    const status = sitePublicStatus(tenant.status, tenant.site.status);
    if (status !== "PUBLISHED") {
      throw new ApiException(status === "SUSPENDED" ? API_ERROR_CODES.TENANT_SUSPENDED : API_ERROR_CODES.SITE_NOT_FOUND);
    }
    const asset = await this.prisma.siteAsset.findFirst({ where: { id: assetId, siteId: tenant.site.id } });
    if (!asset || asset.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Visuel introuvable");
    }
    const remote = this.cloudinary.publicUrl(asset.storageKey);
    if (remote) {
      return { kind: "redirect" as const, url: remote };
    }
    return { kind: "file" as const, file: this.streamAsset(asset) };
  }

  async removeSection(userId: string, tenantId: string, pageId: string, sectionId: string) {
    const tenant = await this.requireMutableSite(userId, tenantId);
    this.assertCapability(tenant, "pages");
    const site = await this.requireSite(tenant);
    const section = site.pages.find((item) => item.id === pageId)?.sections.find((item) => item.id === sectionId);
    if (!section) {
      throw new ApiException(API_ERROR_CODES.SECTION_NOT_FOUND);
    }
    await this.prisma.siteSection.delete({ where: { id: section.id } });
    return { deleted: true };
  }

  private async requireMutableSite(userId: string, tenantId: string) {
    return this.access.getWorkspaceForMember(userId, tenantId, { mutate: true });
  }

  private async requireSite(tenant: WorkspaceRecord): Promise<SiteRecord> {
    if (tenant.site) {
      const full = await this.prisma.tenantSite.findUnique({
        where: { id: tenant.site.id },
        include: sitePagesInclude,
      });
      if (full) {
        return full;
      }
    }
    throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND);
  }

  private async requireSiteById(siteId: string) {
    return this.prisma.tenantSite.findUniqueOrThrow({
      where: { id: siteId },
      include: sitePagesInclude,
    });
  }

  private async loadTenantById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: workspaceWithRelations,
    });
    if (!tenant) {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND);
    }
    return tenant;
  }

  private async loadTenantBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        ...workspaceWithRelations,
        site: { include: sitePagesInclude },
      },
    });
  }

  private async takenSlugs(base: string) {
    const rows = await this.prisma.tenant.findMany({
      where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
      select: { slug: true },
    });
    return new Set(rows.map((row) => row.slug));
  }

  private async assertSlugAvailable(slug: string, tenantId: string) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== tenantId) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Cet identifiant public est déjà utilisé", { slug });
    }
  }

  private assertCapability(tenant: WorkspaceRecord, capability: Capability) {
    assertOfferingCapability(tenant, capability);
  }

  private async writeHours(tx: Prisma.TransactionClient, siteId: string, input: UpdateSiteHoursDto) {
    for (const day of input.days) {
      const closed = day.isClosed ?? false;
      await tx.siteOpeningHour.upsert({
        where: { siteId_weekday: { siteId, weekday: day.weekday } },
        update: {
          isClosed: closed,
          opensAt: closed ? null : day.opensAt,
          closesAt: closed ? null : day.closesAt,
        },
        create: {
          siteId,
          weekday: day.weekday,
          isClosed: closed,
          opensAt: closed ? null : day.opensAt,
          closesAt: closed ? null : day.closesAt,
        },
      });
    }
  }

  private async saveAsset(
    tenantId: string,
    shopSlug: string,
    siteId: string,
    kind: "LOGO" | "COVER" | "FAVICON" | "BANNER" | "SECTION",
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    alt?: string | null,
    sectionId?: string,
  ) {
    if (!ALLOWED_IMAGE.has(file.mimetype)) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Format de visuel non accepté (JPEG, PNG, WebP)");
    }
    const asset = await this.prisma.siteAsset.create({
      data: {
        siteId,
        sectionId,
        kind,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "pending",
        alt,
      },
    });
    let storageKey: string;
    try {
      if (this.cloudinary.isEnabled()) {
        const uploaded = await this.cloudinary.uploadSiteAsset({
          shopSlug,
          siteId,
          assetId: asset.id,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        storageKey = uploaded.storageKey;
      } else {
        storageKey = this.storage.key(`${tenantId}/site/${siteId}`, asset.id, file.originalname);
        await this.storage.save(storageKey, file.buffer);
      }
    } catch (error) {
      await this.prisma.siteAsset.delete({ where: { id: asset.id } });
      throw error;
    }
    return this.prisma.siteAsset.update({ where: { id: asset.id }, data: { storageKey } });
  }

  private streamAsset(asset: { storageKey: string; mimeType: string; originalName: string }) {
    return new StreamableFile(this.storage.stream(asset.storageKey), {
      type: asset.mimeType,
      disposition: `inline; filename="${asset.originalName.replaceAll('"', "")}"`,
    });
  }
}
