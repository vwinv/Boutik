"use client";

import { useCallback, useEffect, useState } from "react";
import { staffApi } from "../lib/api";
import { fetchStaffMe, type StaffUser } from "../lib/auth";
import { formatXof } from "../lib/format";
import { AdminShell } from "./admin-shell";

type OfferCategory = "VITRINE" | "RESTAURANT" | "BOUTIQUE";

type FeatureRow = {
  label: string;
  value: string;
  included?: boolean;
};

type FeatureSection = {
  title: string;
  rows: FeatureRow[];
};

type OfferTier = {
  key: string;
  slug?: string;
  name: string;
  description: string;
  category: OfferCategory | null;
  featured: boolean;
  isActive: boolean;
  statusLabel: string;
  monthlyXof: number;
  yearlyXof: number;
  commissionPct: number | null;
  maxCatalogItems: number | null;
  maxAppointments: number | null;
  maxCollaborators: number;
  trialDays: number;
  subscribersCount: number;
  planIds: string[];
  plans: Array<{ id: string; category: OfferCategory }>;
  highlight: string[];
  features: {
    title: string;
    subtitle: string;
    sections: FeatureSection[];
  };
};

type Payload = {
  category: OfferCategory | null;
  categoryLabel?: string;
  tiers: OfferTier[];
};

const OFFER_CATEGORIES: Array<{ value: OfferCategory; label: string }> = [
  { value: "BOUTIQUE", label: "Boutique" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "VITRINE", label: "Site vitrine" },
];

export function OffresPage() {
  return <OffresBody />;
}

function OffresBody() {
  const [data, setData] = useState<Payload | null>(null);
  const [me, setMe] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfferTier | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [category, setCategory] = useState<OfferCategory>("BOUTIQUE");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextCategory: OfferCategory) => {
    setError(null);
    setLoading(true);
    try {
      const [payload, user] = await Promise.all([
        staffApi<Payload>(`/api/admin/catalog/offers?category=${nextCategory}`),
        fetchStaffMe(),
      ]);
      setData(payload);
      setMe(user);
      setSelectedKey(
        payload.tiers.find((tier) => tier.featured)?.key ?? payload.tiers[0]?.key ?? null,
      );
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Impossible de charger les offres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  const canManage = me?.staffRole === "OWNER" || me?.staffRole === "ADMIN";

  async function saveOffer(input: OfferFormValues) {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const targets =
          editing.plans?.length > 0
            ? editing.plans.filter((plan) => plan.category === category)
            : editing.planIds.map((id) => ({ id, category }));
        const plansToUpdate =
          targets.length > 0 ? targets : [{ id: editing.planIds[0]!, category: input.category }];
        await Promise.all(
          plansToUpdate.map(async (plan) => {
            await staffApi(`/api/admin/catalog/plans/${plan.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: input.name,
                description: input.description,
                ...limitsPayloadForCategory(plan.category, input),
              }),
            });
            await staffApi(`/api/admin/catalog/plans/${plan.id}/prices`, {
              method: "PUT",
              body: JSON.stringify({
                prices: [
                  { interval: "MONTHLY", amountXof: input.monthlyXof, isActive: true },
                  { interval: "YEARLY", amountXof: input.yearlyXof, isActive: true },
                ],
              }),
            });
          }),
        );
        setEditing(null);
      } else {
        await staffApi("/api/admin/catalog/plans", {
          method: "POST",
          body: JSON.stringify({
            slug: input.slug,
            name: input.name,
            description: input.description,
            category: input.category,
            isActive: true,
            isDefault: false,
            includesPremiumTemplates: false,
            sortOrder: 50,
            capabilities: defaultCapabilities(input.category),
            ...limitsPayloadForCategory(input.category, input),
            prices: [
              { interval: "MONTHLY", amountXof: input.monthlyXof, isActive: true },
              { interval: "YEARLY", amountXof: input.yearlyXof, isActive: true },
            ],
          }),
        });
        setCreating(false);
      }
      await load(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOffer(tier: OfferTier) {
    const planId = tier.planIds[0] ?? tier.plans[0]?.id;
    if (!planId) return;
    const confirmed = window.confirm(
      `Supprimer l’offre « ${tier.name} » ? Cette action est définitive.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await staffApi(`/api/admin/catalog/plans/${planId}`, { method: "DELETE" });
      if (selectedKey === tier.key) setSelectedKey(null);
      if (editing?.key === tier.key) setEditing(null);
      await load(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  const selected = data?.tiers.find((tier) => tier.key === selectedKey) ?? data?.tiers[0];

  return (
    <AdminShell
      title="Offres"
      headerRight={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="whitespace-nowrap">Catégorie d’offres</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as OfferCategory)}
              className="min-w-[160px] rounded-full border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-950 outline-none focus:border-neutral-400"
            >
              {OFFER_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {canManage ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              + Créer une offre
            </button>
          ) : null}
        </div>
      }
    >
      {loading && !data ? (
        <p className="text-sm text-neutral-500">Chargement des offres…</p>
      ) : !data ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm text-neutral-400">Chargement des offres…</p> : null}

          <p className="text-sm text-neutral-500">
            {data.tiers.length} offre{data.tiers.length === 1 ? "" : "s"}{" "}
            {data.categoryLabel ??
              OFFER_CATEGORIES.find((item) => item.value === category)?.label.toLowerCase()}
          </p>

          {data.tiers.length === 0 ? (
            <p className="rounded-[24px] border border-dashed border-neutral-200 bg-white px-5 py-10 text-center text-sm text-neutral-500">
              Aucune offre pour cette catégorie.
            </p>
          ) : (
            <>
              <div key={category} className="grid gap-4 md:grid-cols-3">
                {data.tiers.map((tier) => (
                  <TierCard
                    key={tier.key}
                    tier={tier}
                    categoryLabel={
                      data.categoryLabel ??
                      OFFER_CATEGORIES.find((item) => item.value === category)?.label ??
                      category
                    }
                    selected={selectedKey === tier.key}
                    canManage={canManage}
                    busy={busy}
                    onSelect={() => setSelectedKey(tier.key)}
                    onEdit={() => setEditing(tier)}
                    onDelete={() => void deleteOffer(tier)}
                  />
                ))}
              </div>

              {selected?.features ? (
                <section className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-100 px-5 py-5 sm:px-6">
                    <h2 className="text-base font-semibold tracking-tight">{selected.features.title}</h2>
                    <p className="mt-1 text-sm text-neutral-500">{selected.features.subtitle}</p>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {selected.features.sections.map((section) => (
                      <FeatureSectionBlock key={section.title} section={section} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      )}

      {editing || creating ? (
        <OfferFormModal
          mode={editing ? "edit" : "create"}
          initial={
            editing
              ? {
                  name: editing.name,
                  slug: editing.slug ?? editing.key,
                  category,
                  description: editing.description,
                  monthlyXof: editing.monthlyXof,
                  yearlyXof: editing.yearlyXof,
                  commissionPct: editing.commissionPct,
                  maxCatalogItems: editing.maxCatalogItems,
                  maxAppointments: editing.maxAppointments,
                  maxCollaborators: editing.maxCollaborators,
                }
              : {
                  name: "",
                  slug: "",
                  category,
                  description: "Nouvelle offre Boutik",
                  monthlyXof: 0,
                  yearlyXof: 0,
                  commissionPct: category === "VITRINE" ? null : 5,
                  maxCatalogItems: null,
                  maxAppointments: null,
                  maxCollaborators: 1,
                }
          }
          busy={busy}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(values) => void saveOffer(values)}
        />
      ) : null}
    </AdminShell>
  );
}

type OfferFormValues = {
  name: string;
  slug: string;
  category: OfferCategory;
  description: string;
  monthlyXof: number;
  yearlyXof: number;
  commissionPct: number | null;
  maxCatalogItems: number | null;
  maxAppointments: number | null;
  maxCollaborators: number;
};

function defaultCapabilities(category: OfferCategory) {
  if (category === "BOUTIQUE") {
    return ["pages", "gallery", "contact", "seo", "theme", "catalog"];
  }
  if (category === "RESTAURANT") {
    return ["pages", "gallery", "contact", "seo", "theme", "menu", "hours"];
  }
  return ["pages", "gallery", "contact", "seo", "theme", "hours", "reservations"];
}

function limitsPayloadForCategory(category: OfferCategory, input: OfferFormValues) {
  if (category === "VITRINE") {
    return {
      commissionPct: null,
      maxCatalogItems: null,
      maxAppointments: null,
      maxCollaborators: input.maxCollaborators,
    };
  }
  return {
    commissionPct: input.commissionPct,
    maxCatalogItems: input.maxCatalogItems,
    maxAppointments: null,
    maxCollaborators: input.maxCollaborators,
  };
}

function TierCard({
  tier,
  categoryLabel,
  selected,
  canManage,
  busy,
  onSelect,
  onEdit,
  onDelete,
}: {
  tier: OfferTier;
  categoryLabel: string;
  selected: boolean;
  canManage: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dark = tier.featured;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`flex min-h-[280px] cursor-pointer flex-col rounded-[24px] p-5 outline-none transition ${
        dark ? "bg-[#1d1d1f] text-white" : "border border-neutral-200 bg-white text-neutral-950"
      } ${
        selected
          ? dark
            ? "ring-2 ring-white ring-offset-2 ring-offset-[#f4f4f5]"
            : "border-neutral-950 ring-2 ring-neutral-950/10"
          : "hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold tracking-[0.12em] uppercase ${dark ? "text-white/45" : "text-neutral-400"}`}>
            {categoryLabel}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{tier.name}</h3>
          {tier.slug ? (
            <p className={`mt-0.5 text-xs ${dark ? "text-white/35" : "text-neutral-400"}`}>{tier.slug}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            dark ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {tier.statusLabel}
        </span>
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {tier.monthlyXof <= 0 ? "Gratuit" : formatXof(tier.monthlyXof)}
      </p>
      {tier.monthlyXof > 0 ? (
        <p className={`mt-1 text-xs ${dark ? "text-white/45" : "text-neutral-400"}`}>par mois</p>
      ) : (
        <p className={`mt-1 text-xs ${dark ? "text-white/45" : "text-neutral-400"}`}>sans abonnement</p>
      )}

      <ul className={`mt-5 space-y-2 text-sm ${dark ? "text-white/70" : "text-neutral-600"}`}>
        {tier.highlight.map((line) => (
          <li key={line} className="flex gap-2">
            <span className={dark ? "text-white/35" : "text-neutral-300"}>•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <p className={`text-sm ${dark ? "text-white/55" : "text-neutral-500"}`}>
          {tier.subscribersCount} abonné{tier.subscribersCount === 1 ? "" : "s"}
        </p>
        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                dark
                  ? "bg-white text-neutral-950"
                  : "border border-neutral-200 bg-neutral-950 text-white"
              }`}
            >
              Modifier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                dark
                  ? "border border-white/25 text-white/80 hover:bg-white/10"
                  : "border border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              Supprimer
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FeatureSectionBlock({ section }: { section: FeatureSection }) {
  return (
    <div>
      <div className="bg-neutral-50/80 px-5 py-3 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          {section.title}
        </p>
      </div>
      <ul>
        {section.rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 border-t border-neutral-100 px-5 py-3.5 text-sm sm:px-6"
          >
            <span className="text-neutral-600">{row.label}</span>
            <span
              className={`font-medium ${
                row.included === false
                  ? "text-neutral-300"
                  : row.included === true
                    ? "text-emerald-700"
                    : "text-neutral-950"
              }`}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfferFormModal({
  mode,
  initial,
  busy,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: OfferFormValues;
  busy: boolean;
  onClose: () => void;
  onSave: (values: OfferFormValues) => void;
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [category, setCategory] = useState<OfferCategory>(initial?.category ?? "BOUTIQUE");
  const [description, setDescription] = useState(
    initial?.description ?? "Nouvelle offre Boutik",
  );
  const [monthlyXof, setMonthlyXof] = useState(String(initial?.monthlyXof ?? 0));
  const [yearlyXof, setYearlyXof] = useState(
    String(initial?.yearlyXof ?? (initial?.monthlyXof ?? 0) * 10),
  );
  const [yearlyTouched, setYearlyTouched] = useState(isEdit);
  const [commissionPct, setCommissionPct] = useState(
    initial?.commissionPct == null ? "5" : String(initial.commissionPct).replace(".", ","),
  );
  const [maxCatalogItems, setMaxCatalogItems] = useState(
    initial?.maxCatalogItems == null ? "" : String(initial.maxCatalogItems),
  );
  const [maxCollaborators, setMaxCollaborators] = useState(
    String(initial?.maxCollaborators ?? 1),
  );

  const monthlyValue = Math.round(Number(monthlyXof.replace(/\s/g, "")) || 0);
  const yearlyValue = Math.round(Number(yearlyXof.replace(/\s/g, "")) || 0);
  const commissionValue = Number(commissionPct.replace(",", ".").replace(/\s/g, ""));
  const catalogValue = maxCatalogItems.trim() === "" ? null : Math.round(Number(maxCatalogItems) || 0);
  const collaboratorsValue = Math.max(1, Math.round(Number(maxCollaborators) || 1));

  const showCommerceLimits = isEdit || category === "BOUTIQUE" || category === "RESTAURANT";
  const catalogLabel = category === "RESTAURANT" ? "Nombre de plats possibles" : "Nombre de produits possibles";

  const limitsValid =
    collaboratorsValue >= 1 &&
    (!showCommerceLimits || (Number.isFinite(commissionValue) && commissionValue >= 0)) &&
    (!showCommerceLimits || catalogValue == null || catalogValue >= 0);

  const valid =
    name.trim().length > 1 &&
    description.trim().length > 1 &&
    monthlyValue >= 0 &&
    yearlyValue >= 0 &&
    limitsValid &&
    (isEdit || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));

  const fieldClass =
    "mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">
          {isEdit ? "Modifier l’offre" : "Créer une offre"}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {isEdit
            ? "Les changements s’appliquent à l’offre de la catégorie sélectionnée."
            : "L’offre sera créée dans la catégorie choisie en haut de page."}
        </p>

        <label className="mt-5 block">
          <span className="text-sm text-neutral-500">Nom</span>
          <input
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!isEdit && !slugTouched) {
                setSlug(
                  next
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }
            }}
            className={fieldClass}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Slug</span>
          <input
            value={slug}
            disabled={isEdit}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className={fieldClass}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Catégorie</span>
          <select value={category} disabled className={fieldClass}>
            {OFFER_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-neutral-400">
            Changez la catégorie via le menu en haut de la page Offres.
          </span>
        </label>

        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={fieldClass}
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-neutral-500">Prix mensuel (FCFA)</span>
            <input
              value={monthlyXof}
              onChange={(event) => {
                const next = event.target.value.replace(/[^\d]/g, "");
                setMonthlyXof(next);
                if (!yearlyTouched) {
                  setYearlyXof(String(Math.round(Number(next) || 0) * 10));
                }
              }}
              inputMode="numeric"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Prix annuel (FCFA)</span>
            <input
              value={yearlyXof}
              onChange={(event) => {
                setYearlyTouched(true);
                setYearlyXof(event.target.value.replace(/[^\d]/g, ""));
              }}
              inputMode="numeric"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-5">
          <p className="text-sm font-medium text-neutral-950">Limites de l’offre</p>
          <p className="mt-1 text-xs text-neutral-400">Laissez vide pour illimité.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {showCommerceLimits ? (
              <>
                <label className="block">
                  <span className="text-sm text-neutral-500">Commission (%)</span>
                  <input
                    value={commissionPct}
                    onChange={(event) =>
                      setCommissionPct(event.target.value.replace(/[^\d.,]/g, ""))
                    }
                    inputMode="decimal"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-neutral-500">{catalogLabel}</span>
                  <input
                    value={maxCatalogItems}
                    onChange={(event) => setMaxCatalogItems(event.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="Illimité"
                    className={fieldClass}
                  />
                </label>
              </>
            ) : null}

            <label className="block">
              <span className="text-sm text-neutral-500">Nombre de collaborateurs</span>
              <input
                value={maxCollaborators}
                onChange={(event) => setMaxCollaborators(event.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                className={fieldClass}
              />
            </label>
          </div>
        </div>

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
            onClick={() =>
              onSave({
                name: name.trim(),
                slug,
                category,
                description: description.trim(),
                monthlyXof: monthlyValue,
                yearlyXof: yearlyValue,
                commissionPct: showCommerceLimits ? commissionValue : null,
                maxCatalogItems: showCommerceLimits ? catalogValue : null,
                maxAppointments: null,
                maxCollaborators: collaboratorsValue,
              })
            }
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
