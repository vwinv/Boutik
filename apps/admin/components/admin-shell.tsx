"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  clearStaffSession,
  fetchStaffMe,
  readStaffSession,
  type StaffUser,
} from "../lib/auth";
import { initialsFromName, staffRoleLabel } from "../lib/format";
import { staffApi } from "../lib/api";
import { LoginView } from "./login-view";

type NavItem = { href: string; label: string; badgeKey?: keyof Badges; soon?: boolean };
type Badges = {
  professionnels: number;
  support: number;
  abonnements: number;
  retraits: number;
};

const PILOTAGE: NavItem[] = [
  { href: "/", label: "Tableau de bord" },
  { href: "/utilisateurs", label: "Utilisateurs" },
];

const CLIENTS: NavItem[] = [
  { href: "/professionnels", label: "Professionnels & espaces", badgeKey: "professionnels" },
  { href: "/support", label: "Support client", badgeKey: "support" },
];

const FINANCE: NavItem[] = [
  { href: "/abonnements", label: "Abonnements", badgeKey: "abonnements" },
  { href: "/wallets", label: "Wallets" },
  { href: "/retraits", label: "Demandes de retrait", badgeKey: "retraits" },
];

const CATALOGUE: NavItem[] = [
  { href: "/offres", label: "Offres" },
  { href: "/modules", label: "Modules" },
];

export function AdminShell({
  children,
  title,
  breadcrumb = "Administration",
  headerRight,
}: {
  children: ReactNode;
  title: string;
  breadcrumb?: string;
  headerRight?: ReactNode;
}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [badges, setBadges] = useState<Badges>({
    professionnels: 0,
    support: 0,
    abonnements: 0,
    retraits: 0,
  });

  const bootstrap = useCallback(async () => {
    const session = readStaffSession();
    if (!session) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const me = await fetchStaffMe();
      if (!me.staffRole || me.staffRole === "NONE") {
        clearStaffSession();
        setUser(null);
      } else {
        setUser(me);
      }
    } catch {
      clearStaffSession();
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void staffApi<{ badges: Badges }>("/api/admin/dashboard")
      .then((payload) => {
        if (!cancelled && payload.badges) setBadges(payload.badges);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#1a1a1a] text-sm text-white/60">
        Chargement…
      </main>
    );
  }

  if (!user) {
    return (
      <LoginView
        onSuccess={() => {
          setReady(false);
          void bootstrap();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col bg-[#1d1d1f] px-4 py-5 text-white lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span className="grid size-8 place-items-center rounded-[9px] bg-white text-sm font-semibold text-neutral-950">
              B
            </span>
            <span className="text-[15px] font-semibold tracking-tight">BoutiK</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase">
              Admin
            </span>
          </div>

          <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pb-4">
            <NavGroup title="Pilotage" items={PILOTAGE} pathname={pathname} badges={badges} />
            <NavGroup title="Clients" items={CLIENTS} pathname={pathname} badges={badges} />
            <NavGroup title="Finance" items={FINANCE} pathname={pathname} badges={badges} />
            <NavGroup title="Catalogue" items={CATALOGUE} pathname={pathname} badges={badges} />
          </nav>

          <div className="mt-auto border-t border-white/10 px-2 pt-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-semibold text-neutral-950">
                {initialsFromName(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-[11px] text-white/50">{staffRoleLabel(user.staffRole)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearStaffSession();
                setUser(null);
              }}
              className="mt-3 w-full rounded-xl px-3 py-2 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              Quitter
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-neutral-200/80 bg-[#f4f4f5]/90 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs text-neutral-500">
                  {breadcrumb} › {title}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              </div>
              {headerRight ? (
                <div className="flex w-full justify-end sm:w-auto">{headerRight}</div>
              ) : null}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
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
  badges: Badges;
}) {
  return (
    <div>
      <p className="px-3 text-[11px] font-semibold tracking-[0.14em] text-white/35 uppercase">{title}</p>
      <ul className="mt-2 space-y-0.5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname === ""
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = item.badgeKey ? badges[item.badgeKey] : 0;
          const className = `flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
            active ? "bg-black font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
          }`;
          const content = (
            <>
              <span>{item.label}</span>
              {badge ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-neutral-950">
                  {badge}
                </span>
              ) : null}
            </>
          );
          if (item.soon) {
            return (
              <li key={item.href}>
                <span className={`${className} cursor-default opacity-45`} title="Bientôt">
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
