import { isReservedSlug } from "./reserved-slugs";

export function publicOrigin() {
  return process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
}

export function rootHostname(origin = publicOrigin()) {
  try {
    return new URL(origin).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "localhost";
  }
}

export function hostnameFromHost(hostHeader?: string | null) {
  if (!hostHeader) {
    return null;
  }
  return hostHeader.split(":")[0]?.toLowerCase() || null;
}

export function tenantSlugFromHost(hostHeader?: string | null, origin = publicOrigin()) {
  const hostname = hostnameFromHost(hostHeader);
  if (!hostname) {
    return null;
  }

  // Pro dashboard lives on admin.{slug}.{root} — not the public site.
  if (workspaceSlugFromHost(hostname, origin)) {
    return null;
  }

  const root = rootHostname(origin);
  let slug: string | null = null;

  if (root === "localhost" || root === "127.0.0.1") {
    const parts = hostname.split(".");
    if (parts.length === 2 && parts[1] === "localhost") {
      slug = parts[0] ?? null;
    } else if (parts.length === 3 && parts[0] === "www" && parts[2] === "localhost") {
      slug = parts[1] ?? null;
    }
  } else if (hostname !== root && hostname !== `www.${root}` && hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1));
    const candidate = sub.startsWith("www.") ? sub.slice(4) : sub;
    slug = candidate.includes(".") ? null : candidate;
  }

  if (!slug || isReservedSlug(slug)) {
    return null;
  }

  return slug;
}

/** Tenant slug when host is the pro dashboard: admin.{slug}.{root} */
export function workspaceSlugFromHost(hostHeader?: string | null, origin = publicOrigin()) {
  const hostname = hostnameFromHost(hostHeader);
  if (!hostname) {
    return null;
  }

  const root = rootHostname(origin);
  let slug: string | null = null;

  if (root === "localhost" || root === "127.0.0.1") {
    const parts = hostname.split(".");
    if (parts.length === 3 && parts[0] === "admin" && parts[2] === "localhost") {
      slug = parts[1] ?? null;
    }
  } else {
    const prefix = "admin.";
    const suffix = `.${root}`;
    if (hostname.startsWith(prefix) && hostname.endsWith(suffix)) {
      const candidate = hostname.slice(prefix.length, -suffix.length);
      slug = candidate.includes(".") ? null : candidate;
    }
  }

  if (!slug || isReservedSlug(slug)) {
    return null;
  }

  return slug;
}

export function siteUrl(slug: string, path = "/", origin = publicOrigin()) {
  return buildTenantUrl(slug, path, origin, "site");
}

export function siteHost(slug: string, origin = publicOrigin()) {
  return new URL(siteUrl(slug, "/", origin)).host;
}

/** Pro dashboard URL: admin.{slug}.localhost / admin.{slug}.{root} */
export function workspaceUrl(slug: string, path = "/", origin = publicOrigin()) {
  return buildTenantUrl(slug, path, origin, "workspace");
}

export function workspaceHost(slug: string, origin = publicOrigin()) {
  return new URL(workspaceUrl(slug, "/", origin)).host;
}

/** Redirection post-login : admin.{slug}… avec tokens dans le hash (cross-origin localStorage). */
export function workspaceAuthUrl(
  slug: string,
  session: { accessToken: string; refreshToken: string },
  origin = publicOrigin(),
) {
  const url = new URL(workspaceUrl(slug, "/", origin));
  url.hash = `boutik_auth=${encodeURIComponent(
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }),
  )}`;
  return url.toString();
}

/**
 * Origine unique pour Facebook JS SDK / Embedded Signup.
 * Évite d’enregistrer admin.{slug}.* chez Meta : un seul domaine plateforme.
 * Override local (tunnel HTTPS) via NEXT_PUBLIC_WHATSAPP_EMBEDDED_ORIGIN.
 */
export function whatsappEmbeddedOrigin(origin = publicOrigin()) {
  const override = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_ORIGIN?.trim().replace(/\/$/, "");
  if (override) return override;
  return origin.replace(/\/$/, "");
}

export function whatsappEmbeddedConnectUrl(path = "/app/whatsapp", origin = publicOrigin()) {
  const base = whatsappEmbeddedOrigin(origin);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Passe la session pro vers une autre origine (localStorage non partagé entre sous-domaines). */
export function withBoutikAuthHash(
  targetUrl: string,
  session: { accessToken: string; refreshToken: string },
) {
  const url = new URL(targetUrl);
  url.hash = `boutik_auth=${encodeURIComponent(
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }),
  )}`;
  return url.toString();
}

export function isWhatsappEmbeddedOrigin(currentOrigin: string, origin = publicOrigin()) {
  try {
    return currentOrigin.replace(/\/$/, "") === whatsappEmbeddedOrigin(origin);
  } catch {
    return false;
  }
}

function buildTenantUrl(
  slug: string,
  path: string,
  origin: string,
  kind: "site" | "workspace",
) {
  const url = new URL(origin);
  const root = rootHostname(origin);
  const local = root === "localhost" || root === "127.0.0.1";
  if (kind === "workspace") {
    url.hostname = local ? `admin.${slug}.localhost` : `admin.${slug}.${root}`;
  } else {
    url.hostname = local ? `${slug}.localhost` : `${slug}.${root}`;
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  url.pathname = suffix;
  url.search = "";
  url.hash = "";
  const href = url.toString();
  return suffix === "/" ? href.replace(/\/$/, "") : href;
}
