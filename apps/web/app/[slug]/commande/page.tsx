import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchTenantBySlug } from "@boutik/sdk";
import { CheckoutPage } from "../../../components/boutique/checkout-view";
import { MaintenancePage } from "../../../components/maintenance-page";
import { isPublicSiteInMaintenance } from "../../../lib/maintenance";
import { publicBasePath, requestHost } from "../../../lib/store-paths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicCheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await fetchTenantBySlug(slug);
  if (!tenant) notFound();
  if (isPublicSiteInMaintenance(tenant)) {
    return <MaintenancePage title={tenant.site?.general.title || tenant.name} />;
  }
  const basePath = publicBasePath(slug, requestHost(await headers()));
  return <CheckoutPage tenant={tenant} basePath={basePath} />;
}
