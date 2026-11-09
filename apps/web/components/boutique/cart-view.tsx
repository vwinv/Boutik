"use client";

import Link from "next/link";
import type { TenantPublic } from "@boutik/sdk";
import { variantNameFromCartKey } from "../../lib/checkout";
import { formatPriceXof } from "../../lib/theme";
import { storeHref } from "../../lib/store-paths";
import { useCart } from "./cart-context";
import { StoreShell } from "./store-shell";

const DEFAULT_DELIVERY_FEE = 2000;

export function CartPage({ tenant, basePath }: { tenant: TenantPublic; basePath: string }) {
  return (
    <StoreShell tenant={tenant} basePath={basePath}>
      <CartView tenant={tenant} basePath={basePath} />
    </StoreShell>
  );
}

function CartView({ basePath }: { tenant: TenantPublic; basePath: string }) {
  const cart = useCart();
  const homeHref = storeHref(basePath, "/");
  const checkoutHref = storeHref(basePath, "/commande");
  const deliveryFee = cart.lines.length ? DEFAULT_DELIVERY_FEE : 0;
  const total = cart.totalXof + deliveryFee;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Votre panier</h1>

      {cart.lines.length === 0 ? (
        <div className="mt-10 rounded-[24px] border px-6 py-12 text-center" style={{ borderColor: "var(--site-border)" }}>
          <p className="text-sm" style={{ color: "var(--site-muted)" }}>
            Votre panier est vide.
          </p>
          <Link
            href={`${homeHref}#boutique`}
            className="mt-5 inline-flex rounded-full px-5 py-3 text-sm font-medium text-white"
            style={{ background: "var(--site-primary)" }}
          >
            Continuer mes achats
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-start">
          <ul className="divide-y" style={{ borderColor: "var(--site-border)" }}>
            {cart.lines.map((line) => (
              <li key={line.slug} className="flex flex-wrap items-center gap-4 py-5 first:pt-0">
                <span className="size-20 shrink-0 overflow-hidden rounded-2xl sm:size-24" style={{ background: "var(--site-card)" }}>
                  {line.image ? <img src={line.image} alt="" className="size-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{line.name.split(" · ")[0]}</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--site-muted)" }}>
                    {formatPriceXof(line.priceXof)}
                    {variantNameFromCartKey(line.slug) ? ` · ${variantNameFromCartKey(line.slug)}` : ""}
                  </p>
                  <div className="mt-3 inline-flex items-center overflow-hidden rounded-full border" style={{ borderColor: "var(--site-border)" }}>
                    <button
                      type="button"
                      aria-label="Diminuer"
                      className="grid size-9 place-items-center"
                      onClick={() => cart.setQuantity(line.slug, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-medium">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Augmenter"
                      className="grid size-9 place-items-center"
                      onClick={() => cart.setQuantity(line.slug, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-semibold">{formatPriceXof(line.priceXof * line.quantity)}</p>
                  <button
                    type="button"
                    className="mt-2 text-sm underline-offset-2 hover:underline"
                    style={{ color: "var(--site-muted)" }}
                    onClick={() => cart.removeItem(line.slug)}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="rounded-[24px] p-5 sm:p-6" style={{ background: "var(--site-card)" }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--site-muted)" }}>Sous-total</span>
              <span className="font-medium">{formatPriceXof(cart.totalXof)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span style={{ color: "var(--site-muted)" }}>Frais de livraison</span>
              <span className="font-medium">{formatPriceXof(deliveryFee)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4 text-base font-semibold" style={{ borderColor: "var(--site-border)" }}>
              <span>Total</span>
              <span>{formatPriceXof(total)}</span>
            </div>
            <Link
              href={checkoutHref}
              className="mt-5 flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-medium text-white"
              style={{ background: "var(--site-primary)" }}
            >
              Commander
            </Link>
            <Link
              href={`${homeHref}#boutique`}
              className="mt-3 block text-center text-sm font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--site-muted)" }}
            >
              Continuer mes achats
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
