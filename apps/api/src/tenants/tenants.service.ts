import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES, capabilitiesFor, sitePublicStatus } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { capabilitiesFromOffering } from "../catalog/effective-capabilities";
import { PrismaService } from "../prisma/prisma.service";
import { presentSite, sitePagesInclude } from "../sites/site.presenter";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { name: "asc" },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      category: tenant.category,
      status: tenant.status,
      capabilities: capabilitiesFor(tenant.category),
    }));
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        plan: true,
        template: { include: { categories: true } },
        selectedOptions: { include: { option: true } },
        site: { include: sitePagesInclude },
      },
    });

    if (!tenant || tenant.status === "ARCHIVED" || tenant.status === "DRAFT") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug });
    }

    const publicStatus = sitePublicStatus(tenant.status, tenant.site?.status ?? null);
    const exposeSite =
      Boolean(tenant.site) && (publicStatus === "PUBLISHED" || publicStatus === "SUSPENDED");

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      category: tenant.category,
      status: tenant.status,
      capabilities: capabilitiesFromOffering(tenant),
      template: tenant.template
        ? {
            id: tenant.template.id,
            slug: tenant.template.slug,
            name: tenant.template.name,
            isPremium: tenant.template.isPremium,
          }
        : null,
      description: tenant.description,
      timezone: tenant.timezone,
      locale: tenant.locale,
      currency: tenant.currency,
      contact: {
        city: tenant.city,
        country: tenant.country,
        email: tenant.contactEmail,
        phone: tenant.contactPhone,
        website: tenant.website,
        addressLine: tenant.addressLine,
      },
      site: exposeSite && tenant.site ? presentSite(tenant, tenant.site, { publicOnly: true }) : null,
    };
  }
}
