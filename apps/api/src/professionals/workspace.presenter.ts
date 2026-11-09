import type {
  DocumentKind,
  MembershipRole,
  Plan,
  PlanOption,
  PlanPrice,
  Professional,
  SiteStatus,
  SiteSubcategory,
  SiteTemplate,
  TemplateCategory,
  Tenant,
  TenantDocument,
  TenantStatus,
} from "@prisma/client";
import { siteHost, sitePublicStatus, siteUrl } from "@boutik/domain";
import { offeringInclude, presentOffering } from "../catalog/catalog.presenter";
import { planLimits } from "../catalog/plan-limits";

export const workspaceWithRelations = {
  professional: true,
  documents: { orderBy: { createdAt: "desc" as const } },
  memberships: {
    select: {
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
  },
  site: {
    select: { id: true, status: true, title: true, publishedAt: true },
  },
  ...offeringInclude,
} as const;

export type WorkspaceRecord = Tenant & {
  professional: Professional;
  documents: TenantDocument[];
  memberships: Array<{
    role: MembershipRole;
    user: { id: string; email: string; name: string };
  }>;
  subcategory: SiteSubcategory | null;
  plan: (Plan & { prices: PlanPrice[]; options: PlanOption[] }) | null;
  template: (SiteTemplate & { categories: TemplateCategory[] }) | null;
  selectedOptions: Array<{ option: PlanOption }>;
  site: { id: string; status: SiteStatus; title: string; publishedAt: Date | null } | null;
};

export function presentDocument(document: TenantDocument) {
  return {
    id: document.id,
    kind: document.kind as DocumentKind,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
  };
}

export function presentWorkspace(tenant: WorkspaceRecord) {
  const owner = tenant.memberships.find((item) => item.role === "OWNER")?.user ?? null;
  const offering = presentOffering(tenant);
  const limits = planLimits(tenant);

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    category: tenant.category,
    status: tenant.status as TenantStatus,
    offering,
    capabilities: offering.capabilities,
    limits,
    professionalId: tenant.professionalId,
    professional: {
      id: tenant.professional.id,
      ownerUserId: tenant.professional.ownerUserId,
      displayName: tenant.professional.displayName,
    },
    owner,
    company: {
      legalName: tenant.legalName,
      ninea: tenant.ninea,
      rccm: tenant.rccm,
      addressLine: tenant.addressLine,
      city: tenant.city,
      region: tenant.region,
      postalCode: tenant.postalCode,
      country: tenant.country,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      website: tenant.website,
    },
    settings: {
      description: tenant.description,
      timezone: tenant.timezone,
      locale: tenant.locale,
      currency: tenant.currency,
    },
    site: tenant.site
      ? {
          id: tenant.site.id,
          status: sitePublicStatus(tenant.status, tenant.site.status),
          title: tenant.site.title,
          host: siteHost(tenant.slug),
          url: siteUrl(tenant.slug),
          publishedAt: tenant.site.publishedAt,
        }
      : null,
    documents: tenant.documents.map(presentDocument),
    suspendedAt: tenant.suspendedAt,
    suspendedReason: tenant.suspendedReason,
    archivedAt: tenant.archivedAt,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

export function isWorkspaceReady(tenant: Pick<Tenant, "name" | "slug" | "legalName" | "contactEmail" | "contactPhone">) {
  return Boolean(tenant.name && tenant.slug && tenant.legalName && (tenant.contactEmail || tenant.contactPhone));
}
