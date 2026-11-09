import type { TenantPublic } from "@boutik/sdk";

export function isPublicSiteInMaintenance(tenant: TenantPublic) {
  return tenant.status === "SUSPENDED" || tenant.site?.status === "SUSPENDED";
}
