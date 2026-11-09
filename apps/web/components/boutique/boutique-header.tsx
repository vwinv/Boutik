"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { storeHref } from "../../lib/store-paths";
import { CartDropdown } from "./cart-dropdown";

export function BoutiqueHeader({
  basePath,
  name,
  logoUrl,
  mark,
}: {
  basePath: string;
  name: string;
  logoUrl: string | null;
  mark: string;
}) {
  const pathname = usePathname();
  const homeHref = storeHref(basePath, "/");
  const catalogueHref = storeHref(basePath, "/catalogue");
  const compteHref = storeHref(basePath, "/compte");

  function isActive(href: string) {
    if (href === homeHref) {
      return pathname === homeHref || pathname === `${basePath}` || pathname === `/${basePath.replace(/^\//, "")}`;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const linkClass = (href: string) =>
    `text-sm font-medium transition-opacity ${isActive(href) ? "opacity-100" : "opacity-65 hover:opacity-100"}`;

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        borderColor: "var(--site-border)",
        background: "color-mix(in srgb, var(--site-bg) 92%, transparent)",
      }}
    >
      <div className="relative flex w-full items-center gap-3 py-3 pr-4 pl-5 sm:gap-4 sm:pr-6 sm:pl-7">
        <Link href={homeHref} className="relative z-10 flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-10 w-auto max-w-[11rem] object-contain object-left" />
          ) : (
            <>
              <span
                className="grid size-9 place-items-center rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--site-primary)" }}
              >
                {mark}
              </span>
              <span className="hidden sm:inline">{name}</span>
            </>
          )}
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link href={homeHref} className={`rounded-full px-3 py-2 ${linkClass(homeHref)}`}>
            Accueil
          </Link>
          <Link href={catalogueHref} className={`rounded-full px-3 py-2 ${linkClass(catalogueHref)}`}>
            Catalogue
          </Link>
          <CartDropdown />
          <Link
            href={compteHref}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${linkClass(compteHref)}`}
          >
            Compte
          </Link>
        </nav>
      </div>
    </header>
  );
}
