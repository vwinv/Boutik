"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { siteUrl, whatsappEmbeddedOrigin } from "@boutik/domain";
import { proApi } from "../lib/api";
import {
  activeProMembership,
  categoryLabel,
  clearProSession,
  fetchProMe,
  initialsFromName,
  readProSession,
  type ProMembership,
  type ProUser,
} from "../lib/auth";

type Capability =
  | "pages"
  | "gallery"
  | "contact"
  | "seo"
  | "theme"
  | "menu"
  | "hours"
  | "reservations"
  | "click_collect"
  | "catalog"
  | "cart"
  | "checkout"
  | "stock"
  | "orders"
  | "wallet"
  | "customers";

type NavItem = {
  href: string;
  label: string;
  badge?: number;
  soon?: boolean;
  /** Si défini, au moins une de ces capacités est requise. */
  requires?: Capability[];
};

const PRINCIPAL: NavItem[] = [
  { href: "/", label: "Tableau de bord" },
  { href: "/site", label: "Mon site" },
  { href: "/personnalisation", label: "Personnalisation" },
  { href: "/contenus", label: "Pages & contenus" },
];

const BOUTIQUE: NavItem[] = [
  { href: "/produits", label: "Produits", requires: ["catalog", "menu"] },
  { href: "/commandes", label: "Commandes", requires: ["orders"] },
  { href: "/whatsapp", label: "WhatsApp", requires: ["orders"] },
  { href: "/clients", label: "Clients", requires: ["customers"] },
  { href: "/stock", label: "Stock", requires: ["stock"] },
];

const GESTION: NavItem[] = [
  { href: "/wallet", label: "Wallet", requires: ["wallet"] },
  { href: "/abonnement", label: "Abonnement" },
  { href: "/notifications", label: "Notifications" },
  { href: "/support", label: "Support" },
  { href: "/parametres", label: "Paramètres", soon: true },
];

type WorkspaceAccess = {
  capabilities: Capability[];
  planName: string | null;
};

function canAccess(caps: Capability[], item: NavItem) {
  if (!item.requires?.length) return true;
  return item.requires.some((capability) => caps.includes(capability));
}

export function ProShell({
  children,
  title,
  breadcrumb,
}: {
  children: ReactNode;
  title: string;
  breadcrumb?: string;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<ProUser | null>(null);
  const [membership, setMembership] = useState<ProMembership | null>(null);
  const [access, setAccess] = useState<WorkspaceAccess>({ capabilities: [], planName: null });
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [ordersToProcess, setOrdersToProcess] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const session = readProSession();
    if (!session) {
      window.location.assign(proLoginUrl());
      return;
    }
    void fetchProMe()
      .then((me) => {
        setUser(me);
        setMembership(activeProMembership(me));
      })
      .catch(() => {
        clearProSession();
        window.location.assign(proLoginUrl());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!membership?.tenantId) return;
    let cancelled = false;
    void proApi<{
      capabilities?: Capability[];
      offering?: { plan?: { name?: string } | null };
      limits?: { planName?: string | null };
    }>(`/api/workspaces/${membership.tenantId}`)
      .then((workspace) => {
        if (cancelled) return;
        setAccess({
          capabilities: workspace.capabilities ?? [],
          planName: workspace.limits?.planName ?? workspace.offering?.plan?.name ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setAccess({ capabilities: [], planName: null });
      });

    void proApi<{ kpis: { ordersToProcess: number } }>(`/api/workspaces/${membership.tenantId}/dashboard`)
      .then((dashboard) => {
        if (!cancelled) setOrdersToProcess(dashboard.kpis.ordersToProcess || 0);
      })
      .catch(() => {
        if (!cancelled) setOrdersToProcess(0);
      });
    void proApi<{ unreadCount: number }>(`/api/workspaces/${membership.tenantId}/notifications`)
      .then((payload) => {
        if (!cancelled) setUnreadNotifications(payload.unreadCount || 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadNotifications(0);
      });
    return () => {
      cancelled = true;
    };
  }, [membership?.tenantId, pathname]);

  const siteHref = useMemo(() => (membership ? siteUrl(membership.slug) : "#"), [membership]);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Pro";
  const boutiqueItems = useMemo(
    () => BOUTIQUE.filter((item) => canAccess(access.capabilities, item)),
    [access.capabilities],
  );
  const gestionItems = useMemo(
    () => GESTION.filter((item) => canAccess(access.capabilities, item)),
    [access.capabilities],
  );
  const boutiqueBadges = useMemo(
    () => (ordersToProcess > 0 ? { "/commandes": ordersToProcess } : undefined),
    [ordersToProcess],
  );
  const gestionBadges = useMemo(
    () => (unreadNotifications > 0 ? { "/notifications": unreadNotifications } : undefined),
    [unreadNotifications],
  );

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f4f5] text-sm text-neutral-500">Chargement…</div>;
  }

  if (!user || !membership) return null;

  return (
    <div className="min-h-screen bg-[#f4f4f5] text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-neutral-200/80 bg-white px-4 py-5 lg:flex">
          <Link href="/" className="flex items-center gap-2.5 px-2 text-[15px] font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[9px] bg-neutral-950 text-sm text-white">B</span>
            Boutik
          </Link>
          <p className="mt-5 px-2 text-sm text-neutral-500">
            Bonjour, {firstName} !{" "}
            <span className="text-neutral-400">
              {membership.name} · {categoryLabel(membership.category)}
            </span>
          </p>

          <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pb-4">
            <NavGroup title="Principal" items={PRINCIPAL} pathname={pathname} />
            {boutiqueItems.length > 0 ? (
              <NavGroup title="Boutique" items={boutiqueItems} pathname={pathname} badges={boutiqueBadges} />
            ) : null}
            <NavGroup title="Gestion" items={gestionItems} pathname={pathname} badges={gestionBadges} />
          </nav>

        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-[#f4f4f5]/90 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <button
                  type="button"
                  className="mb-2 text-sm font-medium text-neutral-500 lg:hidden"
                  onClick={() => setMobileNav((value) => !value)}
                >
                  Menu
                </button>
                <p className="text-xs text-neutral-500">
                  {breadcrumb || `${categoryLabel(membership.category)} › ${title}`}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <a
                  href={siteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium"
                >
                  Voir mon site
                  <span aria-hidden>↗</span>
                </a>
                <Link
                  href="/notifications"
                  className="relative rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium"
                >
                  Notifications
                  {unreadNotifications > 0 ? (
                    <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-neutral-950 text-[10px] text-white">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
                <div className="hidden items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pr-3 pl-1.5 sm:flex">
                  <span className="grid size-8 place-items-center rounded-full bg-neutral-950 text-xs font-semibold text-white">
                    {initialsFromName(user.name)}
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-medium leading-tight">{user.name}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {access.planName ? `Offre ${access.planName}` : "Espace pro"}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearProSession();
                    window.location.assign(proLoginUrl());
                  }}
                  className="rounded-full px-3 py-2 text-sm text-neutral-500 hover:text-neutral-950"
                >
                  Quitter
                </button>
              </div>
            </div>
            {mobileNav ? (
              <nav className="mt-4 space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 lg:hidden">
                <NavGroup title="Principal" items={PRINCIPAL} pathname={pathname} />
                {boutiqueItems.length > 0 ? (
                  <NavGroup title="Boutique" items={boutiqueItems} pathname={pathname} badges={boutiqueBadges} />
                ) : null}
                <NavGroup title="Gestion" items={gestionItems} pathname={pathname} badges={gestionBadges} />
              </nav>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function proLoginUrl() {
  const publicOrigin = (process.env.PUBLIC_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
  const embeddedOrigin = whatsappEmbeddedOrigin();
  const currentPath =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/app";
  const nextPath = currentPath.startsWith("/app") ? currentPath : `/app${currentPath === "/" ? "" : currentPath}`;
  const next = encodeURIComponent(nextPath);

  // Sur tunnel HTTPS / origine Meta, rester sur la même origine pour le login.
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return `${window.location.origin}/connexion?next=${next}`;
  }
  // En local HTTP, préférer l’origine Embedded (tunnel) si différente de PUBLIC_ORIGIN.
  if (embeddedOrigin && embeddedOrigin !== publicOrigin) {
    return `${embeddedOrigin}/connexion?next=${next}`;
  }
  return `${publicOrigin}/connexion?next=${next}`;
}

function NavGroup({
  title,
  items,
  pathname,
  badges,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  badges?: Record<string, number>;
}) {
  return (
    <div>
      <p className="px-3 text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">{title}</p>
      <ul className="mt-2 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const badge = badges?.[item.href];
          const className = `flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
            active ? "bg-neutral-950 font-medium text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
          }`;
          const content = (
            <>
              <span>{item.label}</span>
              {badge ? (
                <span
                  className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${
                    active ? "bg-white text-neutral-950" : "bg-neutral-950 text-white"
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </>
          );
          if (item.soon) {
            return (
              <li key={item.href}>
                <span className={`${className} cursor-default opacity-55`} title="Bientôt">
                  {content}
                </span>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link href={item.href} className={className}>
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
