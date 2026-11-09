"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  slug: string;
  name: string;
  priceXof: number;
  image: string | null;
  quantity: number;
  variantId?: string | null;
  variantName?: string | null;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  totalXof: number;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(tenantSlug: string) {
  return `boutik.cart.${tenantSlug}`;
}

export function CartProvider({ tenantSlug, children }: { tenantSlug: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(tenantSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) setLines(parsed.filter((item) => item?.slug && item.quantity > 0));
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, [tenantSlug]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(storageKey(tenantSlug), JSON.stringify(lines));
  }, [lines, ready, tenantSlug]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalXof = lines.reduce((sum, line) => sum + line.priceXof * line.quantity, 0);
    return {
      lines,
      count,
      totalXof,
      addItem(item, quantity = 1) {
        setLines((current) => {
          const existing = current.find((line) => line.slug === item.slug);
          if (existing) {
            return current.map((line) =>
              line.slug === item.slug ? { ...line, quantity: line.quantity + quantity } : line,
            );
          }
          return [...current, { ...item, quantity }];
        });
      },
      setQuantity(slug, quantity) {
        setLines((current) =>
          quantity <= 0
            ? current.filter((line) => line.slug !== slug)
            : current.map((line) => (line.slug === slug ? { ...line, quantity } : line)),
        );
      },
      removeItem(slug) {
        setLines((current) => current.filter((line) => line.slug !== slug));
      },
      clear() {
        setLines([]);
      },
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
