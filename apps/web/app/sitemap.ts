import type { MetadataRoute } from "next";
import { publicOrigin } from "@boutik/domain";
import { fetchTenants } from "@boutik/sdk";

/** Sitemap plateforme : une entrée par boutique publiée (pages profondes = crawl depuis le site). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin().replace(/\/$/, "");
  try {
    const tenants = await fetchTenants();
    return tenants
      .filter((tenant) => tenant.site?.status === "PUBLISHED" || tenant.site?.url)
      .map((tenant) => {
        const url = (tenant.site?.url || `${origin}/${tenant.slug}`).replace(/\/$/, "");
        return {
          url,
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: 0.8,
        };
      });
  } catch {
    return [{ url: origin, lastModified: new Date() }];
  }
}
