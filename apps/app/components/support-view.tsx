"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type Category =
  | "TECHNIQUE"
  | "PAIEMENT"
  | "COMMANDE"
  | "RETRAIT"
  | "ABONNEMENT"
  | "PERSONNALISATION";

type FaqItem = {
  id: string;
  category: Category;
  categoryLabel: string;
  question: string;
  answer: string;
};

type TicketSummary = {
  id: string;
  number: string;
  subject: string;
  category: Category;
  categoryLabel: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  statusLabel: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TicketDetail = TicketSummary & {
  closedAt: string | null;
  statusSteps: Array<{ key: string; label: string; done: boolean; current: boolean }>;
  messages: Array<{
    id: string;
    authorType: "PRO" | "SUPPORT";
    authorLabel: string;
    body: string;
    createdAt: string;
  }>;
};

type FilterKey = "all" | Category;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "TECHNIQUE", label: "Technique" },
  { key: "PAIEMENT", label: "Paiement" },
  { key: "COMMANDE", label: "Commande" },
  { key: "RETRAIT", label: "Retrait" },
  { key: "ABONNEMENT", label: "Abonnement" },
  { key: "PERSONNALISATION", label: "Personnalisation" },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = FILTERS.filter(
  (item): item is { key: Category; label: string } => item.key !== "all",
).map((item) => ({ value: item.key, label: item.label }));

export function SupportPage() {
  return (
    <ProShell title="Support" breadcrumb="Boutique › Support">
      <SupportBody />
    </ProShell>
  );
}

function SupportBody() {
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState(false);

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
      const [faqPayload, ticketsPayload] = await Promise.all([
        proApi<FaqItem[]>(`/api/workspaces/${active.tenantId}/support/faq`),
        proApi<TicketSummary[]>(`/api/workspaces/${active.tenantId}/support/tickets`),
      ]);
      setFaq(faqPayload);
      setTickets(ticketsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faq.filter((item) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (!q) return true;
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  }, [faq, filter, query]);

  async function openTicket(id: string) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await proApi<TicketDetail>(`/api/workspaces/${tenantId}/support/tickets/${id}`);
      setActiveTicket(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ouvrir le ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(values: { subject: string; category: Category; message: string }) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await proApi<TicketDetail>(`/api/workspaces/${tenantId}/support/tickets`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setTickets((prev) => [toSummary(detail), ...prev.filter((row) => row.id !== detail.id)]);
      setNewOpen(false);
      setActiveTicket(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function replyTicket(message: string) {
    if (!tenantId || !activeTicket) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await proApi<TicketDetail>(
        `/api/workspaces/${tenantId}/support/tickets/${activeTicket.id}/replies`,
        { method: "POST", body: JSON.stringify({ message }) },
      );
      setActiveTicket(detail);
      setTickets((prev) => prev.map((row) => (row.id === detail.id ? toSummary(detail) : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function closeTicket() {
    if (!tenantId || !activeTicket) return;
    if (!window.confirm("Fermer ce ticket ?")) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await proApi<TicketDetail>(
        `/api/workspaces/${tenantId}/support/tickets/${activeTicket.id}/close`,
        { method: "POST" },
      );
      setActiveTicket(detail);
      setTickets((prev) => prev.map((row) => (row.id === detail.id ? toSummary(detail) : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fermeture impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && faq.length === 0) {
    return <p className="text-sm text-neutral-500">Chargement du support…</p>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Questions fréquentes</h2>
          <label className="mt-4 block">
            <span className="sr-only">Rechercher une réponse</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une réponse…"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
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
          <ul className="mt-5 divide-y divide-neutral-100">
            {filteredFaq.length === 0 ? (
              <li className="py-8 text-center text-sm text-neutral-500">Aucune réponse pour cette recherche.</li>
            ) : (
              filteredFaq.map((item) => {
                const open = openFaqId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenFaqId(open ? null : item.id)}
                      className="flex w-full items-start justify-between gap-4 py-4 text-left"
                    >
                      <span className="text-[15px] font-medium tracking-tight">{item.question}</span>
                      <span
                        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-neutral-200 text-sm text-neutral-500 transition-transform ${
                          open ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>
                    {open ? <p className="pb-4 text-sm leading-relaxed text-neutral-500">{item.answer}</p> : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Mes tickets</h2>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="rounded-full bg-neutral-950 px-3.5 py-2 text-sm font-medium text-white"
            >
              + Nouveau ticket
            </button>
          </div>

          <ul className="mt-5 space-y-3">
            {tickets.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                Aucun ticket pour le moment. Posez votre question à l’équipe Boutik.
              </li>
            ) : (
              tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openTicket(ticket.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-400">
                        {ticket.number} · {ticket.categoryLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold tracking-tight">{ticket.subject}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatShortDate(ticket.createdAt)} · {ticket.messageCount} message
                        {ticket.messageCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(ticket.status)}`}>
                      {ticket.statusLabel}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {newOpen ? (
        <NewTicketModal busy={busy} onClose={() => setNewOpen(false)} onSubmit={createTicket} />
      ) : null}

      {activeTicket ? (
        <TicketModal
          ticket={activeTicket}
          busy={busy}
          onClose={() => setActiveTicket(null)}
          onReply={replyTicket}
          onCloseTicket={closeTicket}
        />
      ) : null}
    </div>
  );
}

function NewTicketModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { subject: string; category: Category; message: string }) => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("TECHNIQUE");
  const [message, setMessage] = useState("");
  const valid = subject.trim().length >= 3 && message.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Nouveau ticket</h3>
        <p className="mt-1 text-sm text-neutral-500">L’équipe Boutik vous répond sous 24 h ouvrées.</p>
        <label className="mt-5 block">
          <span className="text-sm text-neutral-500">Sujet *</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Catégorie</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Message *</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            className="mt-2 w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => onSubmit({ subject: subject.trim(), category, message: message.trim() })}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({
  ticket,
  busy,
  onClose,
  onReply,
  onCloseTicket,
}: {
  ticket: TicketDetail;
  busy: boolean;
  onClose: () => void;
  onReply: (message: string) => void;
  onCloseTicket: () => void;
}) {
  const [reply, setReply] = useState("");
  const closed = ticket.status === "CLOSED";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="border-b border-neutral-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-400">
                {ticket.number} · {ticket.categoryLabel}
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{ticket.subject}</h3>
            </div>
            <button type="button" onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-950">
              Fermer
            </button>
          </div>
          <ol className="mt-4 grid grid-cols-4 gap-2">
            {ticket.statusSteps.map((step) => (
              <li key={step.key} className="text-center">
                <span
                  className={`mx-auto block h-1.5 rounded-full ${step.done ? "bg-neutral-950" : "bg-neutral-200"}`}
                />
                <span
                  className={`mt-2 block text-[11px] ${
                    step.current ? "font-semibold text-neutral-950" : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {ticket.messages.map((message) => {
            const mine = message.authorType === "PRO";
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    mine ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  <p className={`text-[11px] ${mine ? "text-white/60" : "text-neutral-400"}`}>
                    {message.authorLabel} · {formatShortDate(message.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {!closed ? (
          <div className="border-t border-neutral-100 px-6 py-4">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
              placeholder="Votre réponse…"
              className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={onCloseTicket}
                className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold"
              >
                Fermer le ticket
              </button>
              <button
                type="button"
                disabled={busy || reply.trim().length < 1}
                onClick={() => {
                  const text = reply.trim();
                  setReply("");
                  void onReply(text);
                }}
                className="ml-auto rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : "Envoyer"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-neutral-100 px-6 py-4 text-sm text-neutral-500">Ce ticket est fermé.</div>
        )}
      </div>
    </div>
  );
}

function toSummary(detail: TicketDetail): TicketSummary {
  return {
    id: detail.id,
    number: detail.number,
    subject: detail.subject,
    category: detail.category,
    categoryLabel: detail.categoryLabel,
    status: detail.status,
    statusLabel: detail.statusLabel,
    messageCount: detail.messageCount,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function statusClass(status: TicketSummary["status"]) {
  if (status === "IN_PROGRESS" || status === "OPEN") return "bg-amber-100 text-amber-800";
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-700";
  return "bg-neutral-100 text-neutral-500";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
