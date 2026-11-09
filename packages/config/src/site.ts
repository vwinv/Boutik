import {
  publicOrigin,
  rootHostname,
  hostnameFromHost,
  siteHost as domainSiteHost,
  siteUrl as domainSiteUrl,
  tenantSlugFromHost as domainTenantSlugFromHost,
  workspaceHost as domainWorkspaceHost,
  workspaceSlugFromHost as domainWorkspaceSlugFromHost,
  workspaceUrl as domainWorkspaceUrl,
} from "@boutik/domain";

export const ports = {
  marketing: 3000,
  admin: 3001,
  app: 3002,
  web: 3003,
  api: 4000,
} as const;

export const routes = {
  marketing: "/",
  admin: "/admin",
  app: "/app",
  site: "/site",
  api: "/api",
} as const;

export function getPublicOrigin() {
  return publicOrigin();
}

export function getRootHostname() {
  return rootHostname();
}

export function hostnameFromHeader(hostHeader?: string | null) {
  return hostnameFromHost(hostHeader);
}

export function tenantSlugFromHost(hostHeader?: string | null) {
  return domainTenantSlugFromHost(hostHeader);
}

export function siteUrl(slug: string, path = "/") {
  return domainSiteUrl(slug, path);
}

export function siteHost(slug: string) {
  return domainSiteHost(slug);
}

export function sitePath(slug: string, path = "/") {
  return domainSiteUrl(slug, path);
}

export function workspaceSlugFromHost(hostHeader?: string | null) {
  return domainWorkspaceSlugFromHost(hostHeader);
}

export function workspaceUrl(slug: string, path = "/") {
  return domainWorkspaceUrl(slug, path);
}

export function workspaceHost(slug: string) {
  return domainWorkspaceHost(slug);
}
