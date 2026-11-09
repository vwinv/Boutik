import { tenantSlugFromHost } from "@boutik/domain";

/** Prefer the public Host (mega.localhost) over the internal rewrite host (127.0.0.1:3003). */
export function requestHost(headersList: { get(name: string): string | null }) {
  return headersList.get("x-forwarded-host") || headersList.get("host");
}

/** Public path prefix: empty on tenant subdomain, `/{slug}` on path-based access. */
export function publicBasePath(slug: string, hostHeader?: string | null) {
  if (hostHeader && tenantSlugFromHost(hostHeader) === slug) {
    return "";
  }
  return `/${slug}`;
}

export function storeHref(basePath: string, path = "/") {
  if (path === "/" || path === "") {
    return basePath || "/";
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${suffix}`;
}
