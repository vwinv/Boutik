"use client";

import { useRef, useState } from "react";
import {
  contentCopy,
  formatPriceXof,
  newContentId,
  parsePriceInput,
  readContentImage,
  validateContentImage,
  type ContentDraft,
  type ContentItem,
} from "./content-data";

export function ContentStep({
  draft,
  category,
  pending,
  error,
  onChange,
  onBack,
  onContinue,
}: {
  draft: ContentDraft;
  category: "BOUTIQUE" | "RESTAURANT" | "VITRINE";
  pending: boolean;
  error: string | null;
  onChange: (items: ContentItem[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const copy = contentCopy(category);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const formPhotoRef = useRef<HTMLInputElement>(null);
  const itemPhotoRef = useRef<HTMLInputElement>(null);
  const editingId = useRef<string | null>(null);

  async function pickPhoto(file: File | undefined, target: "form" | "item") {
    if (!file) return;
    const invalid = validateContentImage(file);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setPhotoBusy(true);
    setLocalError(null);
    try {
      const dataUrl = await readContentImage(file);
      if (target === "form") {
        setPhoto(dataUrl);
        return;
      }
      const id = editingId.current;
      if (!id) return;
      onChange(draft.items.map((item) => (item.id === id ? { ...item, image: dataUrl } : item)));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Impossible de lire la photo.");
    } finally {
      setPhotoBusy(false);
      editingId.current = null;
    }
  }

  function addItem() {
    const trimmed = name.trim();
    const amount = parsePriceInput(price);
    if (trimmed.length < 2) {
      setLocalError(`Indiquez le ${copy.nameLabel.toLowerCase()}.`);
      return;
    }
    if (amount === null) {
      setLocalError("Indiquez un prix valide.");
      return;
    }
    setLocalError(null);
    onChange([
      ...draft.items,
      { id: newContentId(), name: trimmed, priceXof: amount, tag: copy.defaultTag, image: photo },
    ]);
    setName("");
    setPrice("");
    setPhoto(null);
  }

  function removeItem(id: string) {
    onChange(draft.items.filter((item) => item.id !== id));
  }

  function clearFormPhoto() {
    setPhoto(null);
  }

  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">{copy.title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">{copy.subtitle}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="shrink-0">
          <span className="block text-sm font-medium text-neutral-800">{copy.photoLabel}</span>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => formPhotoRef.current?.click()}
              className="relative grid size-14 place-items-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-400 disabled:opacity-60"
              aria-label={photo ? "Changer la photo" : "Ajouter une photo"}
            >
              {photo ? (
                <img src={photo} alt="" className="size-full object-cover" />
              ) : (
                <ImageIcon />
              )}
            </button>
            {photo ? (
              <button
                type="button"
                onClick={clearFormPhoto}
                className="soft rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-600"
              >
                Retirer
              </button>
            ) : null}
          </div>
          <input
            ref={formPhotoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => {
              void pickPhoto(event.target.files?.[0], "form");
              event.target.value = "";
            }}
          />
        </div>
        <label className="block min-w-0 flex-1 text-sm font-medium text-neutral-800">
          {copy.nameLabel}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-normal outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </label>
        <label className="block w-full text-sm font-medium text-neutral-800 sm:w-44">
          {copy.priceLabel}
          <input
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-normal outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </label>
        <button
          type="button"
          onClick={addItem}
          disabled={photoBusy}
          className="soft shrink-0 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {copy.addLabel}
        </button>
      </div>

      {localError || error ? <p className="mt-4 text-sm text-red-600">{localError || error}</p> : null}

      <ul className="mt-6 space-y-2">
        {draft.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-3 py-2.5 sm:px-4"
          >
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => {
                editingId.current = item.id;
                itemPhotoRef.current?.click();
              }}
              className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-200 text-neutral-500 transition-opacity hover:opacity-90 disabled:opacity-60"
              aria-label={item.image ? `Changer la photo de ${item.name}` : `Ajouter une photo à ${item.name}`}
              title="Photo"
            >
              {item.image ? (
                <img src={item.image} alt="" className="size-full object-cover" />
              ) : (
                <ImageIcon />
              )}
            </button>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-neutral-950">{item.name}</span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">{item.tag}</span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-800">
              {formatPriceXof(item.priceXof)}
            </span>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="soft shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <input
        ref={itemPhotoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(event) => {
          void pickPhoto(event.target.files?.[0], "item");
          event.target.value = "";
        }}
      />

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
          disabled={pending || photoBusy}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          Continuer
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M4.5 16.5 9 12l3 3 3.5-4.5 4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
