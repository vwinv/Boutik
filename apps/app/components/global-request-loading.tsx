"use client";

import { useEffect, useState } from "react";
import { subscribeRequestLoading } from "../lib/request-loading";

const SHOW_DELAY_MS = 120;

export function GlobalRequestLoading() {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeRequestLoading(setPending), []);

  useEffect(() => {
    if (pending <= 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/25 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
        <span
          className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950"
          aria-hidden
        />
        <p className="text-sm font-medium text-neutral-800">Chargement…</p>
      </div>
    </div>
  );
}
