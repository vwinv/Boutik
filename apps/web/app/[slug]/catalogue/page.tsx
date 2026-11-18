import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchStorefrontCatalog, fetchTenantBySlug } from "@boutik/sdk";
import { CatalogPage } from "../../../components/boutique/catalog-view";
import { MaintenancePage } from "../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../lib/maintenance";
import { storefrontMetadata } from "../../../lib/seo";
import { publicBasePath, requestHost } from "../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) return { title: "Catalogue introuvable" };
  const brand = tenant.site?.general.title || tenant.name;
  const basePath = publicBasePath(slug, requestHost(await headers()));
  return storefrontMetadata({
    tenant,
    basePath,
    path: "/catalogue",
    title: `Catalogue | ${brand}`,
    description: `Tous les produits de ${brand}`,
    noIndex: isPublicSiteInMaintenance(tenant),
  });
}

export default async function PublicCataloguePage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) notFound();
  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }

  let catalog: Awaited<ReturnType<typeof fetchStorefrontCatalog>>;
  try {
    catalog = await fetchStorefrontCatalog(slug);
  } catch {
    catalog = { slug, currency: tenant.currency || "XOF", categories: [], products: [] };
  }

  const basePath = publicBasePath(slug, requestHost(await headers()));
  return <CatalogPage tenant={tenant} catalog={catalog} basePath={basePath} />;
}
