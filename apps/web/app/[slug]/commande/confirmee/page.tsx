import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchTenantBySlug } from "@boutik/sdk";
import { OrderConfirmedPage } from "../../../../components/boutique/order-confirmed-view";
import { MaintenancePage } from "../../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../../lib/maintenance";
import { publicBasePath, requestHost } from "../../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicOrderConfirmedPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) notFound();
  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }
  const basePath = publicBasePath(slug, requestHost(await headers()));
  return <OrderConfirmedPage tenant={tenant} basePath={basePath} />;
}
