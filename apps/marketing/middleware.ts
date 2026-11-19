import { NextResponse, type NextRequest } from "next/server";
import { siteUrl, tenantSlugFromHost, workspaceSlugFromHost } from "@boutik/domain";

const WEB_ORIGIN = (process.env.WEB_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const APP_ORIGIN = (process.env.APP_ORIGIN || "http://127.0.0.1:3002").replace(/\/$/, "");
const API_ORIGIN = (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/landing") ||
    pathname.startsWith("/onboarding") ||
    /\.(?:avif|css|gif|ico|jpe?g|js|json|map|png|svg|txt|webp|woff2?)$/i.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const search = request.nextUrl.search;
  const host = request.headers.get("host");

  const workspaceSlug = workspaceSlugFromHost(host);
  if (workspaceSlug) {
    if (pathname.startsWith("/api")) {
      return NextResponse.rewrite(new URL(pathname + search, API_ORIGIN));
    }
    // L'app pro a basePath /app : chunks et HMR doivent venir de APP_ORIGIN.
    if (pathname.startsWith("/_next")) {
      return NextResponse.rewrite(new URL(`/app${pathname}${search}`, APP_ORIGIN));
    }
    const appPath = pathname === "/" ? "/app" : pathname.startsWith("/app") ? pathname : `/app${pathname}`;
    return NextResponse.rewrite(new URL(appPath + search, APP_ORIGIN));
  }

  if (pathname.startsWith("/api") || pathname.startsWith("/admin") || pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const slug = tenantSlugFromHost(host);
  if (slug) {
    // API toujours vers Nest (ne pas préfixer /{slug}/api via le site web).
    if (pathname.startsWith("/api")) {
      return NextResponse.rewrite(new URL(pathname + search, API_ORIGIN));
    }
    // Les pages RSC/chunks du site public vivent sur WEB_ORIGIN — pas sur le marketing.
    if (pathname.startsWith("/_next")) {
      return NextResponse.rewrite(new URL(pathname + search, WEB_ORIGIN));
    }
    if (isPublicAsset(pathname)) {
      return NextResponse.next();
    }
    // Évite /mega/mega/... si un lien path-based a fuité sur le sous-domaine.
    const alreadyPrefixed = pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
    const path = alreadyPrefixed ? pathname : pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
    const rewriteUrl = new URL(path + search, WEB_ORIGIN);
    const headers = new Headers(request.headers);
    if (host) headers.set("x-forwarded-host", host);
    return NextResponse.rewrite(rewriteUrl, { request: { headers } });
  }

  if (isPublicAsset(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const legacy = pathname.match(/^\/site\/([a-z0-9-]+)(\/.*)?$/);
  if (legacy?.[1]) {
    // Fallback path-based : rewrite vers web si le wildcard DNS n’est pas encore prêt.
    if (process.env.WEB_ORIGIN) {
      const rest = legacy[2] || "/";
      const path = rest === "/" ? `/${legacy[1]}` : `/${legacy[1]}${rest}`;
      const rewriteUrl = new URL(path + search, WEB_ORIGIN);
      const headers = new Headers(request.headers);
      if (host) headers.set("x-forwarded-host", host);
      return NextResponse.rewrite(rewriteUrl, { request: { headers } });
    }
    return NextResponse.redirect(siteUrl(legacy[1], legacy[2] || "/"));
  }

  return NextResponse.next();
}

export const config = {
  // Inclure /_next pour pouvoir le proxyfier vers web/app selon le host.
  matcher: ["/:path*"],
};
