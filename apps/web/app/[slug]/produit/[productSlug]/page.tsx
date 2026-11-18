import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchStorefrontCatalog, fetchStorefrontProduct, fetchTenantBySlug } from "@boutik/sdk";
import { ProductPage } from "../../../../components/boutique/product-view";
import { MaintenancePage } from "../../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../../lib/maintenance";
import { productJsonLd, productMetadata } from "../../../../lib/seo";
import { publicBasePath, requestHost } from "../../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string; productSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) return { title: "Produit introuvable" };
  const product = await fetchStorefrontProduct(slug, productSlug);
  if (!product) return { title: "Produit introuvable" };
  const basePath = publicBasePath(slug, requestHost(await headers()));
  const meta = productMetadata({ tenant, product, basePath });
  if (isPublicSiteInMaintenance(tenant)) {
    return { ...meta, robots: { index: false, follow: false } };
  }
  return meta;
}

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
  const jsonLd = productJsonLd({ tenant, product, basePath });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductPage tenant={tenant} product={product} related={related} basePath={basePath} />
    </>
  );
}
