import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontCatalog, fetchStorefrontProduct, fetchTenantBySlug } from "@boutik/sdk";
import { ProductPage } from "../../../../components/boutique/product-view";
import { MaintenancePage } from "../../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../../lib/maintenance";
import { publicBasePath, requestHost } from "../../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string; productSlug: string }>;
};

export default async function PublicProductPage({ params }: PageProps) {
  const { slug, productSlug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) notFound();
  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }

  const product = await fetchStorefrontProduct(slug, productSlug);
  if (!product) notFound();

  let related = [] as Awaited<ReturnType<typeof fetchStorefrontCatalog>>["products"];
  try {
    const catalog = await fetchStorefrontCatalog(slug);
    related = catalog.products.filter((item) => item.slug !== product.slug).slice(0, 4);
  } catch {
    related = [];
  }

  const host = requestHost(await headers());
  const basePath = publicBasePath(slug, host);

  return <ProductPage tenant={tenant} product={product} related={related} basePath={basePath} />;
}
