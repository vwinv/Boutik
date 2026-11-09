"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TenantPublic } from "@boutik/sdk";
import { formatPriceXof } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { StoreShell } from "./store-shell";

type ConfirmedOrder = {
  number: string;
  totalXof: number;
  fulfillment: "DELIVERY" | "PICKUP";
  payment: string;
  paymentStatus?: string | null;
  paymentMessage?: string | null;
  awaitCustomerConfirmation?: boolean;
};

export function OrderConfirmedPage({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <OrderConfirmedView tenant={tenant} basePath={basePath} />
    </StoreShell>
  );
}

function OrderConfirmedView({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  const homeHref = storeHref(basePath, "/");
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`boutik.order.${tenant.slug}`);
      if (raw) setOrder(JSON.parse(raw) as ConfirmedOrder);
    } catch {
      setOrder(null);
    }
  }, [tenant.slug]);

  const fulfillmentLabel = order?.fulfillment === "PICKUP" ? "Retrait sur place" : "Livraison";
  const awaitingPayment = order?.paymentStatus === "PENDING";

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20">
      <span
        className="grid size-16 place-items-center rounded-full"
        style={{
          background: awaitingPayment
            ? "color-mix(in srgb, var(--site-primary) 14%, transparent)"
            : "#d1fae5",
          color: awaitingPayment ? "var(--site-primary)" : "#047857",
        }}
      >
        {awaitingPayment ? (
          <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
            <path d="M5 12.5 9.5 17 19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {awaitingPayment ? "Paiement en cours" : "Commande confirmée"}
      </h1>
      <p className="mt-4 text-sm leading-relaxed sm:text-base" style={{ color: "var(--site-muted)" }}>
        {order ? (
          awaitingPayment ? (
            <>
              Votre commande <strong className="text-[var(--site-fg)]">{order.number}</strong> (
              {formatPriceXof(order.totalXof)}) est enregistrée
              {order.awaitCustomerConfirmation
                ? `. Validez le paiement ${order.payment} sur votre téléphone`
                : `. Paiement SoftPay ${order.payment}`}
              {order.paymentMessage ? ` — ${order.paymentMessage}` : ""}. La confirmation arrive dès validation.
            </>
          ) : (
            <>
              Merci ! Votre commande <strong className="text-[var(--site-fg)]">{order.number}</strong> de{" "}
              <strong className="text-[var(--site-fg)]">{formatPriceXof(order.totalXof)}</strong> a bien été reçue.{" "}
              {fulfillmentLabel} · {order.payment}. Vous recevrez un SMS à chaque étape.
            </>
          )
        ) : (
          <>Merci ! Votre commande a bien été reçue. Vous recevrez un SMS à chaque étape.</>
        )}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={homeHref}
          className="rounded-full px-5 py-3 text-sm font-medium text-white"
          style={{ background: "var(--site-primary)" }}
        >
          Retour à l&apos;accueil
        </Link>
        <Link
          href={storeHref(basePath, "/compte")}
          className="rounded-full border px-5 py-3 text-sm font-medium"
          style={{ borderColor: "var(--site-border)" }}
        >
          Voir mon compte
        </Link>
      </div>
    </main>
  );
}
