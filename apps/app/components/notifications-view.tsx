"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type NotifKind =
  | "ORDERS"
  | "PAYMENTS"
  | "WITHDRAWALS"
  | "SUBSCRIPTION"
  | "PUBLICATION"
  | "SECURITY"
  | "SUPPORT";

type NotifItem = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

type NotifPayload = {
  unreadCount: number;
  items: NotifItem[];
};

type FilterKey = "all" | "unread" | NotifKind;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "ORDERS", label: "Commandes" },
  { key: "PAYMENTS", label: "Paiements" },
  { key: "WITHDRAWALS", label: "Retraits" },
  { key: "SUBSCRIPTION", label: "Abonnement" },
  { key: "PUBLICATION", label: "Publication" },
  { key: "SECURITY", label: "Sécurité" },
  { key: "SUPPORT", label: "Support" },
];

const KIND_LABEL: Record<NotifKind, string> = {
  ORDERS: "Commandes",
  PAYMENTS: "Paiements",
  WITHDRAWALS: "Retraits",
  SUBSCRIPTION: "Abonnement",
  PUBLICATION: "Publication",
  SECURITY: "Sécurité",
  SUPPORT: "Support",
};

export function NotificationsPage() {
  return (
    <ProShell title="Notifications" breadcrumb="Boutique › Notifications">
      <NotificationsBody />
    </ProShell>
  );
}

function NotificationsBody() {
  const [data, setData] = useState<NotifPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe();
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      setTenantId(active.tenantId);
      const payload = await proApi<NotifPayload>(`/api/workspaces/${active.tenantId}/notifications`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.items;
    if (filter === "unread") return data.items.filter((item) => !item.read);
    return data.items.filter((item) => item.kind === filter);
  }, [data, filter]);

  async function markAllRead() {
    if (!tenantId) return;
    setBusyId("all");
    try {
      const payload = await proApi<NotifPayload>(`/api/workspaces/${tenantId}/notifications/read-all`, {
        method: "POST",
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function markRead(id: string) {
    if (!tenantId) return;
    setBusyId(id);
    try {
      const payload = await proApi<NotifPayload>(`/api/workspaces/${tenantId}/notifications/${id}/read`, {
        method: "POST",
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    if (!tenantId) return;
    setBusyId(id);
    try {
      const payload = await proApi<NotifPayload>(`/api/workspaces/${tenantId}/notifications/${id}/archive`, {
        method: "POST",
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-neutral-500">Chargement des notifications…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || "Impossible de charger les notifications."}</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-neutral-950 font-medium text-white"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-950"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={busyId === "all" || data.unreadCount === 0}
          onClick={() => void markAllRead()}
          className="shrink-0 self-start rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-40"
        >
          Tout marquer comme lu
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-neutral-500">Aucune notification pour ce filtre.</p>
        ) : (
          <ul>
            {filtered.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 border-b border-neutral-100 px-4 py-4 last:border-b-0 sm:px-5 ${
                  item.read ? "bg-white" : "bg-neutral-50"
                }`}
              >
                <span
                  className={`mt-2 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-neutral-950"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
                    {KIND_LABEL[item.kind]}
                  </p>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (!item.read) void markRead(item.id);
                      }}
                      className="mt-0.5 block text-[15px] font-semibold tracking-tight hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.read) void markRead(item.id);
                      }}
                      className="mt-0.5 block text-left text-[15px] font-semibold tracking-tight"
                    >
                      {item.title}
                    </button>
                  )}
                  <p className="mt-0.5 text-sm text-neutral-500">{item.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time className="text-xs text-neutral-400" dateTime={item.createdAt}>
                    {relativeTime(item.createdAt)}
                  </time>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void archive(item.id)}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-950 disabled:opacity-40"
                  >
                    Archiver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function relativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
