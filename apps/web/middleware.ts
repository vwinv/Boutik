import { NextResponse, type NextRequest } from "next/server";
import { tenantSlugFromHost } from "@boutik/domain";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Ne jamais préfixer les appels API — ils sont proxifiés vers Nest via next.config.
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const slug = tenantSlugFromHost(host);
  if (!slug) {
    return NextResponse.next();
  }

  const prefix = `/${slug}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
