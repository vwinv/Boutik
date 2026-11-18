import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchStorefrontCatalog, fetchTenantBySlug, type StorefrontCatalog } from "@boutik/sdk";
import { BoutiqueSite } from "../../components/boutique-site";
import { MaintenancePage } from "../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../lib/maintenance";
import { localBusinessJsonLd, storefrontMetadata } from "../../lib/seo";
import { publicBasePath, requestHost } from "../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function emptyCatalog(slug: string, currency: string): StorefrontCatalog {
  return { slug, currency, categories: [], products: [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) return { title: "Boutique introuvable" };
  const basePath = publicBasePath(slug, requestHost(await headers()));
  return storefrontMetadata({
    tenant,
    basePath,
    noIndex: isPublicSiteInMaintenance(tenant),
  });
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
  const jsonLd = localBusinessJsonLd(tenant, basePath);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BoutiqueSite tenant={tenant} catalog={catalog} basePath={basePath} />
    </>
  );
}
