import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchTenantBySlug } from "@boutik/sdk";
import { CartPage } from "../../../components/boutique/cart-view";
import { MaintenancePage } from "../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../lib/maintenance";
import { publicBasePath, requestHost } from "../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicCartPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) notFound();
  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }
  const basePath = publicBasePath(slug, requestHost(await headers()));
  return <CartPage tenant={tenant} basePath={basePath} />;
}
