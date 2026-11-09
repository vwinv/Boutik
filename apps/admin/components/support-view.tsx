"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { staffApi } from "../lib/api";
import { AdminShell } from "./admin-shell";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "HIGH" | "MEDIUM" | "LOW";

type StaffMember = { id: string; name: string };

type TicketItem = {
  id: string;
  number: string;
  subject: string;
  category: string;
  categoryLabel: string;
  status: TicketStatus;
  statusLabel: string;
  tenantName: string;
  tenantSlug: string;
  priority: TicketPriority;
  priorityLabel: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  awaitingStaff: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TicketsPayload = {
  kpis: {
    openCount: number;
    inProgressCount: number;
    awaitingCount: number;
    avgFirstResponseMinutes: number | null;
  };
  staffMembers: StaffMember[];
  items: TicketItem[];
};

type TicketDetail = TicketItem & {
  staffMembers: StaffMember[];
  messages: Array<{
    id: string;
    authorType: "PRO" | "SUPPORT";
    authorLabel: string;
    body: string;
    createdAt: string;
  }>;
};

type StatusFilter = "ALL" | TicketStatus;

export function SupportPage() {
  return (
    <AdminShell title="Support client">
      <SupportBody />
    </AdminShell>
  );
}

function SupportBody() {
  const [data, setData] = useState<TicketsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await staffApi<TicketsPayload>("/api/admin/support/tickets"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les tickets.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setReply("");
      return;
    }
    let cancelled = false;
    void staffApi<TicketDetail>(`/api/admin/support/tickets/${selectedId}`)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ticket introuvable.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (!q) return true;
      return (
        item.number.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.tenantName.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [data, query, status]);

  async function patchTicket(body: Record<string, unknown>) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await staffApi<TicketDetail>(`/api/admin/support/tickets/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setDetail(next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const next = await staffApi<TicketDetail>(`/api/admin/support/tickets/${selectedId}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
      });
      setDetail(next);
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="text-sm text-neutral-500">Chargement du support…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un ticket…"
            className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          dark
          label="Ouverts"
          value={String(data.kpis.openCount)}
          sub={data.kpis.awaitingCount > 0 ? "sans réponse" : "aucun en attente"}
        />
        <Kpi label="En cours" value={String(data.kpis.inProgressCount)} sub="en traitement" />
        <Kpi
          label="Première réponse"
          value={formatDuration(data.kpis.avgFirstResponseMinutes)}
          sub="moyenne sur 7 j"
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-5 py-4">
          {(
            [
              ["ALL", "Tous"],
              ["OPEN", "Ouvert"],
              ["IN_PROGRESS", "En cours"],
              ["RESOLVED", "Résolu"],
              ["CLOSED", "Fermé"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                status === key ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">Aucun ticket pour le moment.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.08em] text-neutral-400 uppercase">
                      {ticket.number}
                    </p>
                    <p className="mt-1 font-semibold tracking-tight text-neutral-950">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {ticket.tenantName} · {ticket.categoryLabel} · {relativeTime(ticket.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <PriorityBadge priority={ticket.priority} label={ticket.priorityLabel} />
                    <StatusBadge status={ticket.status} label={ticket.statusLabel} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail ? (
        <TicketPanel
          ticket={detail}
          reply={reply}
          busy={busy}
          onReplyChange={setReply}
          onClose={() => setSelectedId(null)}
          onSubmit={sendReply}
          onStatus={(next) => void patchTicket({ status: next })}
          onPriority={(next) => void patchTicket({ priority: next })}
          onAssignee={(next) => void patchTicket({ assignedToUserId: next })}
        />
      ) : null}
    </div>
  );
}

function TicketPanel({
  ticket,
  reply,
  busy,
  onReplyChange,
  onClose,
  onSubmit,
  onStatus,
  onPriority,
  onAssignee,
}: {
  ticket: TicketDetail;
  reply: string;
  busy: boolean;
  onReplyChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onStatus: (status: TicketStatus) => void;
  onPriority: (priority: TicketPriority) => void;
  onAssignee: (userId: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fermer" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-neutral-950">
              {ticket.subject}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Fermer"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <MetaChip>{ticket.number}</MetaChip>
            <MetaChip>{ticket.categoryLabel}</MetaChip>
            <PriorityBadge priority={ticket.priority} label={ticket.priorityLabel} />
            <StatusBadge status={ticket.status} label={ticket.statusLabel} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-neutral-500">Assigné à</span>
              <select
                value={ticket.assignedToUserId ?? ""}
                disabled={busy}
                onChange={(event) => onAssignee(event.target.value || null)}
                className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Non assigné</option>
                {ticket.staffMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Priorité</span>
              <select
                value={ticket.priority}
                disabled={busy}
                onChange={(event) => onPriority(event.target.value as TicketPriority)}
                className="mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none"
              >
                <option value="HIGH">Haute</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="LOW">Basse</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {ticket.messages.map((message) => (
            <div key={message.id} className="rounded-[22px] bg-neutral-100 px-4 py-3.5">
              <p className="text-xs font-medium text-neutral-500">
                {message.authorLabel} · {formatClock(message.createdAt)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-900 whitespace-pre-wrap">
                {message.body}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="border-t border-neutral-100 px-5 py-4">
          {ticket.status !== "CLOSED" ? (
            <input
              value={reply}
              onChange={(event) => onReplyChange(event.target.value)}
              placeholder={`Répondre à ${ticket.tenantName}…`}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
          ) : (
            <p className="text-sm text-neutral-400">Ticket fermé — réponses désactivées.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["OPEN", "Ouvert"],
                  ["IN_PROGRESS", "En cours"],
                  ["RESOLVED", "Résolu"],
                  ["CLOSED", "Fermé"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => onStatus(key)}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                    ticket.status === key
                      ? "bg-neutral-950 text-white"
                      : "border border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {ticket.status !== "CLOSED" ? (
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "…" : "Envoyer la réponse"}
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <article
      className={`rounded-[22px] px-4 py-4 ${
        dark ? "bg-[#1d1d1f] text-white" : "border border-neutral-200 bg-white text-neutral-950"
      }`}
    >
      <p className={`text-sm ${dark ? "text-white/55" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${dark ? "text-white/45" : "text-neutral-400"}`}>{sub}</p>
    </article>
  );
}

function MetaChip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
      {children}
    </span>
  );
}

function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  const tone =
    status === "RESOLVED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "OPEN"
        ? "bg-neutral-100 text-neutral-600"
        : status === "IN_PROGRESS"
          ? "bg-sky-100 text-sky-800"
          : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function PriorityBadge({
  priority,
  label,
}: {
  priority: TicketPriority;
  label: string;
}) {
  const tone =
    priority === "HIGH"
      ? "bg-red-50 text-red-600"
      : priority === "MEDIUM"
        ? "bg-amber-50 text-amber-700"
        : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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
