"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, formatXof, readProSession } from "../lib/auth";
import { ProShell } from "./pro-shell";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "COD";

type OrderItem = {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
};

type OrderEvent = {
  id: string;
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  message: string | null;
  createdAt: string;
};

type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  fulfillment: "DELIVERY" | "PICKUP";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  addressLine: string | null;
  city: string | null;
  note: string | null;
  totalXof: number;
  deliveryFeeXof: number;
  subtotalXof: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentProvider: string | null; // PAYDUNYA | COD | NONE
  cancelReason: string | null;
  items: OrderItem[];
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "tous" | "PENDING" | "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
type PaymentFilter = "tous" | "PAID" | "PENDING" | "COD" | "FAILED";
type ChannelFilter = "tous" | "whatsapp" | "web";

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: "tous", label: "Tous" },
  { key: "PENDING", label: "Nouvelle" },
  { key: "CONFIRMED", label: "Confirmée" },
  { key: "PREPARING", label: "Préparation" },
  { key: "OUT_FOR_DELIVERY", label: "Expédiée" },
  { key: "DELIVERED", label: "Livrée" },
  { key: "CANCELLED", label: "Annulée" },
];

const PAYMENT_OPTIONS: Array<{ key: PaymentFilter; label: string }> = [
  { key: "tous", label: "Paiement : Tous" },
  { key: "PAID", label: "Paiement : Payé" },
  { key: "PENDING", label: "Paiement : En attente" },
  { key: "COD", label: "Paiement : À la livraison" },
  { key: "FAILED", label: "Paiement : Échoué / remboursé" },
];

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Nouvelle",
  CONFIRMED: "Confirmée",
  PREPARING: "Préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "Expédiée",
  DELIVERED: "Livrée",
  PICKED_UP: "Récupérée",
  CANCELLED: "Annulée",
};

const PIPELINE_STEPS = ["Nouvelle", "Confirmée", "Préparation", "Expédiée", "Livrée"] as const;

function pipelineIndex(status: OrderStatus) {
  if (status === "PENDING") return 0;
  if (status === "CONFIRMED") return 1;
  if (status === "PREPARING" || status === "READY") return 2;
  if (status === "OUT_FOR_DELIVERY") return 3;
  if (status === "DELIVERED" || status === "PICKED_UP") return 4;
  return -1;
}

function primaryAdvance(order: Order): { status: OrderStatus; label: string } | null {
  if (order.status === "PENDING") return { status: "CONFIRMED", label: "Passer à « Confirmée »" };
  if (order.status === "CONFIRMED") return { status: "PREPARING", label: "Passer à « Préparation »" };
  if (order.status === "PREPARING") return { status: "READY", label: "Passer à « Prête »" };
  if (order.status === "READY" && order.fulfillment === "DELIVERY") {
    return { status: "OUT_FOR_DELIVERY", label: "Passer à « Expédiée »" };
  }
  if (order.status === "READY" && order.fulfillment === "PICKUP") {
    return { status: "PICKED_UP", label: "Passer à « Récupérée »" };
  }
  if (order.status === "OUT_FOR_DELIVERY") return { status: "DELIVERED", label: "Passer à « Livrée »" };
  return null;
}

function paymentLabel(status: PaymentStatus) {
  if (status === "PAID") return "Payé";
  if (status === "PENDING") return "En attente";
  if (status === "COD") return "À la livraison";
  if (status === "FAILED") return "Échoué";
  if (status === "CANCELLED") return "Remboursée";
  return status;
}

function paymentTextClass(status: PaymentStatus) {
  if (status === "PAID") return "text-emerald-600";
  if (status === "PENDING") return "text-orange-600";
  if (status === "FAILED" || status === "CANCELLED") return "text-red-600";
  return "text-neutral-800";
}

function matchesStatusFilter(order: Order, filter: StatusFilter) {
  if (filter === "tous") return true;
  if (filter === "PREPARING") return order.status === "PREPARING" || order.status === "READY";
  if (filter === "DELIVERED") return order.status === "DELIVERED" || order.status === "PICKED_UP";
  return order.status === filter;
}

function matchesPaymentFilter(order: Order, filter: PaymentFilter) {
  if (filter === "tous") return true;
  if (filter === "FAILED") return order.paymentStatus === "FAILED" || order.paymentStatus === "CANCELLED";
  return order.paymentStatus === filter;
}

function isWhatsappOrder(order: Order) {
  return order.paymentMethod === "whatsapp" || (order.note || "").toLowerCase().includes("whatsapp");
}

function matchesChannelFilter(order: Order, filter: ChannelFilter) {
  if (filter === "tous") return true;
  if (filter === "whatsapp") return isWhatsappOrder(order);
  return !isWhatsappOrder(order);
}

export function CommandesPage() {
  return (
    <ProShell title="Commandes">
      <CommandesBody />
    </ProShell>
  );
}

function CommandesBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tous");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("tous");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("tous");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canal = new URLSearchParams(window.location.search).get("canal");
    if (canal === "whatsapp" || canal === "web") setChannelFilter(canal);
  }, []);

  const load = useCallback(async () => {
    const session = readProSession();
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchProMe(session.accessToken);
      const active = activeProMembership(me);
      if (!active) throw new Error("Aucun espace professionnel rattaché à ce compte.");
      setTenantId(active.tenantId);
      const list = await proApi<Order[]>(`/api/workspaces/${active.tenantId}/orders`);
      setOrders(list);
      setSelected((current) => (current ? list.find((item) => item.id === current.id) || null : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesStatusFilter(order, statusFilter)) return false;
      if (!matchesPaymentFilter(order, paymentFilter)) return false;
      if (!matchesChannelFilter(order, channelFilter)) return false;
      if (!q) return true;
      return (
        order.number.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q) ||
        (order.customerEmail || "").toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, paymentFilter, channelFilter, query]);

  async function setOrderStatus(order: Order, status: OrderStatus) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      if (status === "CANCELLED") {
        const reason = window.prompt("Motif d’annulation (optionnel)") || undefined;
        await proApi(`/api/workspaces/${tenantId}/orders/${order.id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: reason || null }),
        });
      } else {
        await proApi(`/api/workspaces/${tenantId}/orders/${order.id}/status`, {
          method: "POST",
          body: JSON.stringify({ status }),
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function refundOrder(order: Order) {
    if (!tenantId) return;
    const onlinePaid = order.paymentStatus === "PAID" && order.paymentProvider === "PAYDUNYA";
    const ok = window.confirm(
      onlinePaid
        ? `Rembourser ${formatXof(order.totalXof)} vers ${order.customerPhone} via PayDunya cashout ?`
        : `Marquer ${order.number} comme remboursée ? (paiement à la livraison — aucun cashout PayDunya)`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/orders/${order.id}/refund`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remboursement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[24px] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                statusFilter === key ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sm:w-44">
            <span className="sr-only">Filtrer par canal</span>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)}
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm outline-none focus:border-neutral-400"
            >
              <option value="tous">Canal : Tous</option>
              <option value="whatsapp">Canal : WhatsApp</option>
              <option value="web">Canal : Site web</option>
            </select>
          </label>
          <label className="sm:w-56">
            <span className="sr-only">Filtrer par paiement</span>
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm outline-none focus:border-neutral-400"
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Rechercher</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Client ou nº …"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pr-4 pl-9 text-sm outline-none focus:border-neutral-400"
            />
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-400">⌕</span>
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-[24px] bg-white">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Chargement des commandes…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">Aucune commande pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-100 text-[11px] font-semibold tracking-[0.08em] text-neutral-400 uppercase">
                <tr>
                  <th className="px-5 py-3.5">N°</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Montant</th>
                  <th className="px-5 py-3.5">Paiement</th>
                  <th className="px-5 py-3.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50/80"
                    onClick={() => setSelected(order)}
                  >
                    <td className="px-5 py-4 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {order.number}
                        {isWhatsappOrder(order) ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            WhatsApp
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-xs text-neutral-500">{order.customerPhone}</p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-neutral-600">{formatOrderDate(order.createdAt)}</td>
                    <td className="px-5 py-4 font-medium whitespace-nowrap">{formatXof(order.totalXof)}</td>
                    <td className="px-5 py-4">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <OrderDetailModal
          order={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onAdvance={(status) => void setOrderStatus(selected, status)}
          onCancel={() => void setOrderStatus(selected, "CANCELLED")}
          onRefund={() => void refundOrder(selected)}
        />
      ) : null}
    </div>
  );
}

function OrderDetailModal({
  order,
  busy,
  onClose,
  onAdvance,
  onCancel,
  onRefund,
}: {
  order: Order;
  busy: boolean;
  onClose: () => void;
  onAdvance: (status: OrderStatus) => void;
  onCancel: () => void;
  onRefund: () => void;
}) {
  const advance = primaryAdvance(order);
  const step = pipelineIndex(order.status);
  const cancelled = order.status === "CANCELLED";
  const canCancel =
    !cancelled &&
    order.status !== "OUT_FOR_DELIVERY" &&
    order.status !== "DELIVERED" &&
    order.status !== "PICKED_UP";
  const alreadyRefunded = order.paymentStatus === "CANCELLED";
  const canRefund = cancelled && !alreadyRefunded;
  const refundUsesCashout = order.paymentStatus === "PAID" && order.paymentProvider === "PAYDUNYA";
  const history = (order.events || []).filter((event) => event.toStatus || event.type === "CREATED");
  const phoneHref = `tel:${order.customerPhone.replace(/\s+/g, "")}`;
  const mailHref = order.customerEmail ? `mailto:${order.customerEmail}` : null;
  const deliveryLabel =
    order.fulfillment === "PICKUP"
      ? "Retrait sur place"
      : [order.addressLine, order.city].filter(Boolean).join(", ") || "Livraison";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[min(920px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-sm text-neutral-500">
              {order.number} · {formatOrderDate(order.createdAt)}
              {isWhatsappOrder(order) ? " · WhatsApp" : ""}
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{order.customerName}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="grid size-9 place-items-center rounded-full text-lg text-neutral-500 hover:bg-neutral-100"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <ol className="grid grid-cols-5 gap-2">
            {PIPELINE_STEPS.map((label, index) => {
              const done = !cancelled && step >= index;
              const current = !cancelled && step === index;
              return (
                <li key={label} className="min-w-0 text-center">
                  <span
                    className={`mx-auto block h-1.5 rounded-full ${
                      cancelled ? "bg-neutral-200" : done ? "bg-neutral-950" : "bg-neutral-200"
                    }`}
                  />
                  <span
                    className={`mt-2 block truncate text-[11px] font-medium sm:text-xs ${
                      current ? "text-neutral-950" : done ? "text-neutral-700" : "text-neutral-400"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard label="Contact" value={order.customerPhone} />
            <InfoCard label="Livraison" value={deliveryLabel} />
            <InfoCard
              label="Paiement"
              value={paymentLabel(order.paymentStatus)}
              valueClassName={paymentTextClass(order.paymentStatus)}
            />
          </div>

          <section className="overflow-hidden rounded-2xl border border-neutral-100">
            <ul className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-400">
                    <ProductThumbIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    {item.variantName ? (
                      <p className="truncate text-xs text-neutral-600">Variante : {item.variantName}</p>
                    ) : null}
                    <p className="text-xs text-neutral-500">x {item.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium whitespace-nowrap">{formatXof(item.lineTotalXof)}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Sous-total</span>
                <span>{formatXof(order.subtotalXof)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Frais de livraison</span>
                <span>{formatXof(order.deliveryFeeXof)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-neutral-950">
                <span>Total</span>
                <span>{formatXof(order.totalXof)}</span>
              </div>
            </div>
          </section>

          {order.note ? (
            <section>
              <p className="text-xs font-semibold tracking-[0.08em] text-neutral-400 uppercase">Note</p>
              <p className="mt-1.5 text-sm text-neutral-700">{order.note}</p>
            </section>
          ) : null}

          <section>
            <p className="text-xs font-semibold tracking-[0.08em] text-neutral-400 uppercase">Historique</p>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                {ORDER_STATUS_LABEL[order.status]} · {formatOrderDateTime(order.createdAt)}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {history.map((event) => {
                  const status = event.toStatus || "PENDING";
                  return (
                    <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{ORDER_STATUS_LABEL[status] || status}</span>
                      <span className="text-neutral-500">{formatOrderDateTime(event.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {order.cancelReason ? (
              <p className="mt-2 text-sm text-red-600">Motif : {order.cancelReason}</p>
            ) : null}
          </section>
        </div>

        <div className="shrink-0 space-y-3 border-t border-neutral-100 bg-white px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={phoneHref}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
            >
              Appeler
            </a>
            {mailHref ? (
              <a
                href={mailHref}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
              >
                Envoyer un email
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-400"
              >
                Envoyer un email
              </button>
            )}
            <button
              type="button"
              disabled={busy || !canRefund}
              title={
                !cancelled
                  ? "Annulez d’abord la commande"
                  : alreadyRefunded
                    ? "Déjà remboursée"
                    : undefined
              }
              onClick={onRefund}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
            >
              {busy && canRefund ? "Remboursement…" : "Rembourser"}
            </button>
          </div>
          {cancelled && !alreadyRefunded ? (
            <p className="text-xs text-neutral-500">
              {refundUsesCashout
                ? "Cashout PayDunya vers le téléphone du client."
                : "Paiement à la livraison / non encaissé : marquage remboursé sans cashout PayDunya."}
            </p>
          ) : null}
          {cancelled && alreadyRefunded ? (
            <p className="text-xs text-neutral-500">Cette commande est déjà marquée remboursée.</p>
          ) : null}
          {canCancel || advance ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {canCancel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancel}
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Annuler la commande
                </button>
              ) : null}
              {advance ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAdvance(advance.status)}
                  className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Mise à jour…" : advance.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-400 uppercase">{label}</p>
      <p className={`mt-1.5 text-sm font-medium ${valueClassName || "text-neutral-900"}`}>{value}</p>
    </div>
  );
}

function ProductThumbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4 16l4.5-4 3.5 3 3-2.5L20 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; className: string }> = {
    PAID: { label: "Payé", className: "bg-emerald-50 text-emerald-700" },
    PENDING: { label: "En attente", className: "bg-orange-50 text-orange-700" },
    COD: { label: "À la livraison", className: "bg-sky-50 text-sky-700" },
    FAILED: { label: "Échoué", className: "bg-red-50 text-red-700" },
    CANCELLED: { label: "Remboursée", className: "bg-red-50 text-red-700" },
  };
  const tone = map[status] || { label: status, className: "bg-neutral-100 text-neutral-600" };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.className}`}>{tone.label}</span>;
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABEL[status] || status;
  const className =
    status === "CONFIRMED" || status === "DELIVERED" || status === "PICKED_UP"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CANCELLED"
        ? "bg-red-50 text-red-700"
        : status === "PENDING"
          ? "bg-neutral-100 text-neutral-600"
          : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>{label}</span>;
}

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatOrderDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}
