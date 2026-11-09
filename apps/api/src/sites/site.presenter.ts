import type { SiteAsset, SiteOpeningHour, SitePage, SiteSection, Tenant, TenantSite } from "@prisma/client";
import { siteHost, sitePublicStatus, siteUrl } from "@boutik/domain";
import { capabilitiesFromOffering } from "../catalog/effective-capabilities";
import { resolveCloudinaryUrl } from "../professionals/cloudinary-media.storage";
import type { WorkspaceRecord } from "../professionals/workspace.presenter";

export const sitePagesInclude = {
  pages: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      sections: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  hours: { orderBy: { weekday: "asc" as const } },
  assets: true,
} as const;

export type SitePageRecord = SitePage & { sections: SiteSection[] };

export type SiteRecord = TenantSite & { pages: SitePageRecord[]; hours: SiteOpeningHour[]; assets: SiteAsset[] };

type MediaOptions = {
  slug: string;
  tenantId: string;
  publicOnly?: boolean;
  assetsById?: Map<string, Pick<SiteAsset, "storageKey">>;
};

export function mediaUrl(ref: string | null | undefined, options: MediaOptions) {
  if (!ref) {
    return null;
  }
  if (!ref.startsWith("asset:")) {
    return ref;
  }
  const assetId = ref.slice("asset:".length);
  const asset = options.assetsById?.get(assetId);
  const remote = asset ? resolveCloudinaryUrl(asset.storageKey) : null;
  if (remote) {
    return remote;
  }
  if (options.publicOnly) {
    return `/api/storefront/site-assets/${assetId}?slug=${encodeURIComponent(options.slug)}`;
  }
  return `/api/workspaces/${options.tenantId}/site/assets/${assetId}/file`;
}

export function presentSection(section: SiteSection, options: MediaOptions) {
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    body: section.body,
    imageUrl: mediaUrl(section.imageUrl, options),
    sortOrder: section.sortOrder,
    isVisible: section.isVisible,
  };
}

export function presentPage(page: SitePageRecord, options: MediaOptions) {
  const sections = options.publicOnly ? page.sections.filter((item) => item.isVisible) : page.sections;
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    isHome: page.isHome,
    isVisible: page.isVisible,
    sortOrder: page.sortOrder,
    seo: {
      title: page.seoTitle,
      description: page.seoDescription,
    },
    sections: sections.map((section) => presentSection(section, options)),
  };
}

export function presentHours(hours: SiteOpeningHour[]) {
  return hours.map((item) => ({
    weekday: item.weekday,
    opensAt: item.opensAt,
    closesAt: item.closesAt,
    isClosed: item.isClosed,
  }));
}

export function presentSiteSummary(tenant: Pick<Tenant, "slug" | "status">, site: Pick<TenantSite, "id" | "status" | "title" | "publishedAt"> | null) {
  if (!site) {
    return null;
  }
  return {
    id: site.id,
    status: sitePublicStatus(tenant.status, site.status),
    title: site.title,
    host: siteHost(tenant.slug),
    url: siteUrl(tenant.slug),
    publishedAt: site.publishedAt,
  };
}

type SiteTenant = {
  id: string;
  slug: string;
  name: string;
  category: WorkspaceRecord["category"];
  status: WorkspaceRecord["status"];
  plan: { capabilities: string[] } | null;
  selectedOptions: Array<{ option: { capability: string | null } }>;
  template: { id: string; slug: string; name: string } | null;
};

export function presentSite(tenant: SiteTenant, site: SiteRecord, options?: { publicOnly?: boolean }) {
  const status = sitePublicStatus(tenant.status, site.status);
  const pages = options?.publicOnly ? site.pages.filter((page) => page.isVisible) : site.pages;
  const assetsById = new Map((site.assets ?? []).map((asset) => [asset.id, asset]));
  const media: MediaOptions = {
    slug: tenant.slug,
    tenantId: tenant.id,
    publicOnly: options?.publicOnly,
    assetsById,
  };

  return {
    id: site.id,
    tenantId: tenant.id,
    slug: tenant.slug,
    host: siteHost(tenant.slug),
    url: siteUrl(tenant.slug),
    status,
    siteStatus: site.status,
    category: tenant.category,
    capabilities: capabilitiesFromOffering(tenant),
    template: tenant.template
      ? { id: tenant.template.id, slug: tenant.template.slug, name: tenant.template.name }
      : null,
    general: {
      title: site.title,
      tagline: site.tagline,
      about: site.about,
    },
    theme: {
      layoutKey: site.layoutKey,
      primaryColor: site.primaryColor,
      secondaryColor: site.secondaryColor,
      backgroundColor: site.backgroundColor,
      textColor: site.textColor,
      logoUrl: mediaUrl(site.logoUrl, media),
      coverUrl: mediaUrl(site.coverUrl, media),
      bannerUrl: mediaUrl(site.bannerUrl, media),
      faviconUrl: mediaUrl(site.faviconUrl, media),
    },
    contact: {
      email: site.email,
      phone: site.phone,
      whatsapp: site.whatsapp,
      addressLine: site.addressLine,
      city: site.city,
    },
    hours: presentHours(site.hours),
    social: {
      facebookUrl: site.facebookUrl,
      instagramUrl: site.instagramUrl,
      tiktokUrl: site.tiktokUrl,
      youtubeUrl: site.youtubeUrl,
      linkedinUrl: site.linkedinUrl,
      xUrl: site.xUrl,
    },
    seo: {
      title: site.seoTitle,
      description: site.seoDescription,
      keywords: site.seoKeywords,
      ogImageUrl: site.ogImageUrl,
    },
    pages: pages.map((page) => presentPage(page, media)),
    publishedAt: site.publishedAt,
    unpublishedAt: site.unpublishedAt,
    suspendedAt: site.suspendedAt,
    suspendedReason: site.suspendedReason,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}

export function missingPublishFields(site: Pick<TenantSite, "title">, pages: SitePageRecord[]) {
  const missing: string[] = [];
  if (!site.title.trim()) {
    missing.push("title");
  }
  if (!pages.some((page) => page.isHome && page.isVisible)) {
    missing.push("homePage");
  }
  return missing;
}

