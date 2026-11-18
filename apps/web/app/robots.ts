import type { MetadataRoute } from "next";
import { publicOrigin } from "@boutik/domain";

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/panier", "/*/commande", "/*/compte"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
