"use client";

import { useState } from "react";
import type { ContentItem } from "./content-data";
import { SitePreview } from "./site-preview";
import type { TemplateDraft } from "./templates";

export function PreviewStep({
  template,
  items,
  businessName,
  category,
  coverUrl,
  pending,
  error,
  onBack,
  onContinue,
}: {
  template: TemplateDraft;
  items: ContentItem[];
  businessName: string;
  category: "BOUTIQUE" | "RESTAURANT" | "VITRINE";
  coverUrl?: string | null;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");

  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Vérifiez votre site</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
          Voici ce que verront vos visiteurs. Revenez en arrière pour modifier.
        </p>
      </div>

      <div className="mt-6 inline-flex rounded-full bg-neutral-100 p-1">
        <button
          type="button"
          aria-pressed={mode === "desktop"}
          onClick={() => setMode("desktop")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "desktop" ? "bg-neutral-950 text-white" : "text-neutral-600"
          }`}
        >
          Ordinateur
        </button>
        <button
          type="button"
          aria-pressed={mode === "mobile"}
          onClick={() => setMode("mobile")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "mobile" ? "bg-neutral-950 text-white" : "text-neutral-600"
          }`}
        >
          Mobile
        </button>
      </div>

      <div className="mt-6 flex flex-1 justify-center overflow-auto pb-2">
        <SitePreview
          template={template}
          items={items}
          businessName={businessName}
          category={category}
          coverUrl={coverUrl}
          mode={mode}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          Passer à la publication
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}
