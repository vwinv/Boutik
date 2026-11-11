import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontCatalog, fetchTenantBySlug, type StorefrontCatalog } from "@boutik/sdk";
import { BoutiqueSite } from "../../components/boutique-site";
import { MaintenancePage } from "../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../lib/maintenance";
import { publicBasePath, requestHost } from "../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function emptyCatalog(slug: string, currency: string): StorefrontCatalog {
  return { slug, currency, categories: [], products: [] };
}

export default async function PublicSitePage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }

  let catalog: StorefrontCatalog = emptyCatalog(slug, tenant.currency || "XOF");
  try {
    catalog = await fetchStorefrontCatalog(slug);
  } catch {
    catalog = emptyCatalog(slug, tenant.currency || "XOF");
  }

  const host = requestHost(await headers());
  const basePath = publicBasePath(slug, host);

  return <BoutiqueSite tenant={tenant} catalog={catalog} basePath={basePath} />;
}
