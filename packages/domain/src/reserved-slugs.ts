export const RESERVED_SLUGS = [
  "admin",
  "app",
  "api",
  "site",
  "login",
  "signup",
  "register",
  "pricing",
  "blog",
  "legal",
  "privacy",
  "terms",
  "contact",
  "about",
  "features",
  "docs",
  "status",
  "static",
  "assets",
  "www",
  "support",
  "mail",
  "cdn",
] as const;

export function isReservedSlug(slug: string) {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
