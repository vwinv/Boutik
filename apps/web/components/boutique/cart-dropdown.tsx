"use client";

import { useEffect, useRef, useState } from "react";
import { formatPriceXof } from "../../lib/theme";
import { useCart } from "./cart-context";

export function CartDropdown() {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: "inherit" }}
      >
        Panier
        <span
          className="inline-grid size-5 place-items-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: "var(--site-primary)" }}
        >
          {cart.count}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Panier"
          className="absolute top-full right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border shadow-xl"
          style={{ background: "var(--site-bg)", borderColor: "var(--site-border)", color: "var(--site-fg)" }}
        >
          <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--site-border)" }}>
            Votre panier
          </div>
          {cart.lines.length === 0 ? (
            <p className="px-4 py-6 text-sm" style={{ color: "var(--site-muted)" }}>
              Votre panier est vide.
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto py-2">
              {cart.lines.map((line) => (
                <li key={line.slug} className="flex gap-3 px-4 py-2.5">
                  <span className="size-12 shrink-0 overflow-hidden rounded-xl" style={{ background: "var(--site-card)" }}>
                    {line.image ? <img src={line.image} alt="" className="size-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{line.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--site-muted)" }}>
                      {formatPriceXof(line.priceXof)}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="grid size-6 place-items-center rounded-full text-xs"
                        style={{ background: "var(--site-card)" }}
                        onClick={() => cart.setQuantity(line.slug, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="text-xs tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        className="grid size-6 place-items-center rounded-full text-xs"
                        style={{ background: "var(--site-card)" }}
                        onClick={() => cart.setQuantity(line.slug, line.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs"
                        style={{ color: "var(--site-muted)" }}
                        onClick={() => cart.removeItem(line.slug)}
                      >
                        Retirer
                      </button>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t px-4 py-3" style={{ borderColor: "var(--site-border)" }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--site-muted)" }}>Total</span>
              <span className="font-semibold" style={{ color: "var(--site-primary)" }}>
                {formatPriceXof(cart.totalXof)}
              </span>
            </div>
            <button
              type="button"
              disabled={cart.lines.length === 0}
              className="mt-3 w-full rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--site-primary)" }}
            >
              Commander
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
