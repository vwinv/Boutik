"use client";

import { useCallback, useEffect, useState } from "react";
import { readCustomerSession, type CustomerSession } from "../../lib/customer-auth";
import { isLightLayout, resolveLayout } from "../../lib/theme";
import { CustomerAuthPopup } from "./customer-auth-popup";

type Review = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
};

type ReviewsPayload = {
  enabled: boolean;
  average: number | null;
  count: number;
  reviews: Review[];
};

export function ProductReviews({
  tenantSlug,
  tenantName,
  productSlug,
  layoutKey,
}: {
  tenantSlug: string;
  tenantName: string;
  productSlug: string;
  layoutKey?: string | null;
}) {
  const light = isLightLayout(resolveLayout(layoutKey));
  const [data, setData] = useState<ReviewsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `/api/storefront/catalog/${encodeURIComponent(productSlug)}/reviews?slug=${encodeURIComponent(tenantSlug)}`,
      );
      const payload = (await response.json()) as { ok?: boolean; data?: ReviewsPayload; error?: { message?: string } };
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error?.message || "Impossible de charger les avis.");
      }
      setData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les avis.");
      setData(null);
    }
  }, [productSlug, tenantSlug]);

  useEffect(() => {
    setCustomer(readCustomerSession(tenantSlug));
    void load();
  }, [load, tenantSlug]);

  useEffect(() => {
    if (customer?.user.name && !authorName) {
      setAuthorName(customer.user.name);
    }
  }, [customer, authorName]);

  async function submitReview(session: CustomerSession | null) {
    const active = session || customer || readCustomerSession(tenantSlug);
    if (!active) {
      setPendingSubmit(true);
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch(
        `/api/storefront/catalog/${encodeURIComponent(productSlug)}/reviews?slug=${encodeURIComponent(tenantSlug)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${active.accessToken}`,
          },
          body: JSON.stringify({
            rating,
            authorName: authorName.trim() || active.user.name,
            body: body.trim(),
          }),
        },
      );
      const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } };
      if (!payload.ok) {
        throw new Error(payload.error?.message || "Envoi impossible.");
      }
      setBody("");
      setRating(5);
      setPendingSubmit(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return null;
  }
  if (!data) {
    return (
      <section className="mt-14 sm:mt-16">
        <div className="h-40 animate-pulse rounded-[24px]" style={{ background: "var(--site-card)" }} />
      </section>
    );
  }
  if (!data.enabled) {
    return null;
  }

  return (
    <section className="mt-14 sm:mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Avis clients</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--site-muted)" }}>
            {data.count
              ? `${data.average?.toFixed(1)} / 5 · ${data.count} avis`
              : "Soyez le premier à laisser un avis sur ce produit."}
          </p>
        </div>
      </div>

      <div
        className="mt-6 rounded-[24px] p-5 sm:p-6"
        style={{ background: light ? "var(--site-card)" : "rgba(255,255,255,0.04)", border: "1px solid var(--site-border)" }}
      >
        <p className="text-sm font-medium">Laisser un avis</p>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
              onClick={() => setRating(value)}
              className="text-xl leading-none"
              style={{ color: value <= rating ? "var(--site-primary)" : "var(--site-muted)" }}
            >
              ★
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="sr-only">Votre nom</span>
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Votre nom"
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--site-border)" }}
          />
        </label>
        <label className="mt-3 block">
          <span className="sr-only">Votre avis</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Partagez votre expérience avec ce produit…"
            rows={4}
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--site-border)" }}
          />
        </label>
        {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
        <button
          type="button"
          disabled={busy || body.trim().length < 8 || authorName.trim().length < 2}
          onClick={() => void submitReview(customer)}
          className="mt-4 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {customer ? "Publier mon avis" : "Se connecter pour publier"}
        </button>
      </div>

      <ul className="mt-8 space-y-4">
        {data.reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-[22px] px-5 py-4"
            style={{ background: light ? "var(--site-card)" : "rgba(255,255,255,0.04)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{review.authorName}</p>
              <p className="text-sm" style={{ color: "var(--site-primary)" }}>
                {"★".repeat(review.rating)}
                <span style={{ color: "var(--site-muted)" }}>{"★".repeat(5 - review.rating)}</span>
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
              {review.body}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--site-muted)" }}>
              {new Date(review.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </li>
        ))}
      </ul>

      <CustomerAuthPopup
        open={authOpen}
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        layoutKey={layoutKey}
        prefill={{ name: authorName }}
        onClose={() => {
          setAuthOpen(false);
          setPendingSubmit(false);
        }}
        onSuccess={(session) => {
          setCustomer(session);
          setAuthOpen(false);
          if (!authorName.trim()) setAuthorName(session.user.name);
          if (pendingSubmit) void submitReview(session);
        }}
      />
    </section>
  );
}
