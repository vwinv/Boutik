"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { proApi } from "../lib/api";
import { activeProMembership, fetchProMe, readProSession } from "../lib/auth";
import {
  ADDABLE_BLOCKS,
  CORE_BLOCKS,
  isRemovedBlock,
  parseBlockKey,
  presetForKey,
  stripBlockMarker,
  withBlockMarker,
  type BlockKey,
  type BlockPreset,
} from "../lib/content-blocks";
import { AuthImage } from "./auth-image";
import { ProShell } from "./pro-shell";

type Section = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
};

type Page = {
  id: string;
  slug: string;
  title: string;
  isHome: boolean;
  isVisible: boolean;
  sortOrder: number;
  sections: Section[];
};

type SiteData = {
  id: string;
  tenantId: string;
  slug: string;
  host: string;
  url: string;
  status: string;
  category: string;
  general: { title: string; tagline: string | null; about: string | null };
  theme: {
    layoutKey: string | null;
    primaryColor: string | null;
    coverUrl: string | null;
    logoUrl: string | null;
  };
  pages: Page[];
};

type ListItem =
  | {
      kind: "section";
      id: string;
      pageId: string;
      title: string;
      description: string;
      mandatory: boolean;
      visible: boolean;
      blockKey: BlockKey | null;
      section: Section;
    }
  | {
      kind: "page";
      id: string;
      title: string;
      description: string;
      mandatory: boolean;
      visible: boolean;
      page: Page;
    };

export function ContenusPage() {
  return (
    <ProShell title="Pages & contenus">
      <ContenusBody />
    </ProShell>
  );
}

function ContenusBody() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ListItem | null>(null);

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
      let data: SiteData;
      try {
        data = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`);
      } catch {
        data = await proApi<SiteData>(`/api/workspaces/${active.tenantId}/site`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
      data = await ensureCoreSections(active.tenantId, data);
      setSite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les contenus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const home = useMemo(() => site?.pages.find((page) => page.isHome) || site?.pages[0] || null, [site]);
  const contact = useMemo(() => site?.pages.find((page) => page.slug === "contact") || null, [site]);

  const items = useMemo<ListItem[]>(() => {
    if (!home) return [];
    const sections = [...home.sections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((section) => !isRemovedBlock(section.body, section.title));
    const list: ListItem[] = sections.map((section) => {
      const key = parseBlockKey(section.body, section.type);
      const preset = key ? presetForKey(key) : null;
      return {
        kind: "section",
        id: section.id,
        pageId: home.id,
        title: section.title || preset?.title || section.type,
        description: preset?.description || descriptionForType(section.type),
        mandatory: Boolean(preset?.mandatory || section.type === "HERO"),
        visible: section.isVisible,
        blockKey: key,
        section,
      };
    });
    if (contact) {
      list.push({
        kind: "page",
        id: contact.id,
        title: contact.title || "Contact",
        description: "Section Contact du site public",
        mandatory: true,
        visible: contact.isVisible,
        page: contact,
      });
    }
    return list;
  }, [home, contact]);

  const presentKeys = useMemo(
    () => new Set(items.filter((item) => item.kind === "section" && item.blockKey).map((item) => (item as Extract<ListItem, { kind: "section" }>).blockKey)),
    [items],
  );

  async function refreshSite() {
    if (!tenantId) return;
    const data = await proApi<SiteData>(`/api/workspaces/${tenantId}/site`);
    setSite(data);
  }

  async function toggleItem(item: ListItem) {
    if (!tenantId || item.mandatory && item.kind === "section" && item.section.type === "HERO") return;
    setBusy(true);
    setError(null);
    try {
      if (item.kind === "section") {
        await proApi(`/api/workspaces/${tenantId}/site/pages/${item.pageId}/sections/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isVisible: !item.visible }),
        });
      } else {
        await proApi(`/api/workspaces/${tenantId}/site/pages/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isVisible: !item.visible }),
        });
      }
      await refreshSite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function moveSection(item: Extract<ListItem, { kind: "section" }>, direction: -1 | 1) {
    if (!tenantId || !home) return;
    const ordered = items.filter((entry): entry is Extract<ListItem, { kind: "section" }> => entry.kind === "section");
    const index = ordered.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [removed] = next.splice(index, 1);
    if (!removed) return;
    next.splice(target, 0, removed);
    setBusy(true);
    try {
      await proApi(`/api/workspaces/${tenantId}/site/pages/${home.id}/sections/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ ids: next.map((entry) => entry.id) }),
      });
      await refreshSite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réordonnancement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: ListItem) {
    if (!tenantId || item.mandatory) return;
    if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
    setBusy(true);
    setError(null);
    try {
      if (item.kind === "section") {
        await proApi(`/api/workspaces/${tenantId}/site/pages/${item.pageId}/sections/${item.id}`, {
          method: "DELETE",
        });
      }
      await refreshSite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function addBlock(preset: BlockPreset) {
    if (!tenantId || !home || !preset.addable) return;
    if (presentKeys.has(preset.key)) return;
    setBusy(true);
    setAddOpen(false);
    setError(null);
    try {
      await proApi(`/api/workspaces/${tenantId}/site/pages/${home.id}/sections`, {
        method: "POST",
        body: JSON.stringify({
          type: preset.type,
          title: preset.title,
          body: withBlockMarker(
            preset.key,
            preset.key === "about" ? site?.general.about || site?.general.tagline : null,
          ),
          isVisible: true,
          sortOrder: home.sections.length,
        }),
      });
      await refreshSite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(values: { title: string; body: string }) {
    if (!tenantId || !editItem) return;
    setBusy(true);
    setError(null);
    try {
      if (editItem.kind === "section") {
        const key = editItem.blockKey;
        const body = values.body.trim();
        await proApi(`/api/workspaces/${tenantId}/site/pages/${editItem.pageId}/sections/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: values.title.trim() || editItem.title,
            body: key ? withBlockMarker(key, body) : body || null,
          }),
        });
        // À propos du site public : le corps de l'élément alimente aussi general.about
        if (key === "about") {
          await proApi(`/api/workspaces/${tenantId}/site`, {
            method: "PATCH",
            body: JSON.stringify({ about: body || null }),
          });
        }
      } else {
        await proApi(`/api/workspaces/${tenantId}/site/pages/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: values.title.trim() || editItem.title }),
        });
      }
      setEditItem(null);
      await refreshSite();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="h-[520px] animate-pulse rounded-[24px] bg-white" />
        <div className="h-[520px] animate-pulse rounded-[24px] bg-white" />
      </div>
    );
  }

  if (!site || !home) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white px-5 py-8 text-sm text-red-600">
        {error || "Contenus indisponibles."}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.85fr)]">
        <section className="rounded-[24px] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Éléments du site</h2>
              <p className="mt-1 text-sm text-neutral-500">Activez, désactivez ou modifiez les éléments de la page publique.</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((value) => !value)}
                className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
              >
                + Ajouter
              </button>
              {addOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
                  {ADDABLE_BLOCKS.map((preset) => {
                    const exists = presentKeys.has(preset.key);
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        disabled={exists || busy}
                        onClick={() => void addBlock(preset)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-neutral-50 disabled:opacity-45"
                      >
                        <span>{preset.title}</span>
                        {exists ? <span className="text-neutral-400">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <ul className="mt-5 divide-y divide-neutral-100">
            {items.map((item, index) => (
              <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-3 py-4">
                <div className="flex w-14 shrink-0 items-center gap-1">
                  <span className="w-5 text-sm text-neutral-400">{index + 1}</span>
                  {item.kind === "section" ? (
                    <span className="flex flex-col">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void moveSection(item, -1)}
                        className="text-xs text-neutral-400 hover:text-neutral-800"
                        aria-label="Monter"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void moveSection(item, 1)}
                        className="text-xs text-neutral-400 hover:text-neutral-800"
                        aria-label="Descendre"
                      >
                        ▼
                      </button>
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium tracking-tight">{item.title}</p>
                    {item.mandatory ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                        Obligatoire
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-500">{item.description}</p>
                </div>

                {!(item.kind === "section" && item.section.type === "HERO") ? (
                  <Toggle checked={item.visible} disabled={busy} onChange={() => void toggleItem(item)} />
                ) : (
                  <span className="w-11" />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditItem(item)}
                    className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium"
                  >
                    Modifier
                  </button>
                  {!item.mandatory ? (
                    <button
                      type="button"
                      onClick={() => void removeItem(item)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-500"
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[24px] bg-white p-5">
            <h2 className="text-base font-semibold tracking-tight">Aperçu</h2>
            <p className="mt-1 text-sm text-neutral-500">État des éléments actifs sur le site public.</p>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-neutral-200">
              <ContentPreview site={site} items={items} />
            </div>
          </section>
        </aside>
      </div>

      {editItem ? (
        <EditModal
          item={editItem}
          busy={busy}
          onClose={() => setEditItem(null)}
          onSave={(values) => void saveEdit(values)}
        />
      ) : null}
    </>
  );
}

function ContentPreview({ site, items }: { site: SiteData; items: ListItem[] }) {
  const primary = site.theme.primaryColor || "#c4457a";
  const visible = items.filter((item) => item.visible || (item.kind === "section" && item.section.type === "HERO"));
  return (
    <div className="bg-neutral-950 text-white">
      <div className="border-b border-white/10 px-4 py-3 text-xs text-white/60">{site.host}</div>
      <div className="space-y-3 p-4">
        <div className="overflow-hidden rounded-2xl" style={{ background: primary }}>
          <div className="relative aspect-[16/9]">
            <AuthImage
              src={site.theme.coverUrl ?? undefined}
              className="absolute inset-0 size-full object-cover opacity-80"
              fallback={<div className="size-full bg-black/20" />}
            />
            <div className="absolute inset-0 flex items-end p-4">
              <p className="text-sm font-semibold leading-snug">
                {site.general.tagline || "Mode et artisanat d’Afrique de l’Ouest, livrés chez vous."}
              </p>
            </div>
          </div>
        </div>
        {visible.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-white/10 px-3 py-2.5">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-white/50">{item.visible ? "Visible" : "Masqué"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditModal({
  item,
  busy,
  onClose,
  onSave,
}: {
  item: ListItem;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { title: string; body: string }) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(
    item.kind === "section" ? stripBlockMarker(item.section.body) : item.description,
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight">Modifier · {item.title}</h3>
        <label className="mt-4 block">
          <span className="text-sm text-neutral-500">Titre</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
          />
        </label>
        {item.kind === "section" ? (
          <label className="mt-4 block">
            <span className="text-sm text-neutral-500">
              {item.blockKey === "about"
                ? "Texte de la section À propos"
                : item.blockKey === "reviews"
                  ? "Message d’intro (optionnel)"
                  : "Contenu"}
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder={
                item.blockKey === "about"
                  ? "Présentez votre activité sur le site public…"
                  : item.blockKey === "reviews"
                    ? "Les clients pourront noter et commenter vos produits."
                    : undefined
              }
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-400"
            />
          </label>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            Cet élément active ou masque la section Contact de l’accueil public. Les coordonnées se règlent aussi dans les paramètres du site.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ title, body })}
            className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-neutral-950" : "bg-neutral-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function descriptionForType(type: string) {
  if (type === "HERO") return "Bannière et message d’accueil";
  if (type === "GALLERY") return "Galerie d’images";
  if (type === "CTA") return "Appel à l’action";
  if (type === "CONTACT") return "Coordonnées";
  return "Élément de contenu";
}

async function ensureCoreSections(tenantId: string, site: SiteData): Promise<SiteData> {
  const home = site.pages.find((page) => page.isHome);
  if (!home) return site;

  let sections = [...home.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  // Retirer Catalogue / Catégories (plus gérés dans Pages & contenus).
  for (const section of sections) {
    if (!isRemovedBlock(section.body, section.title)) continue;
    await proApi(`/api/workspaces/${tenantId}/site/pages/${home.id}/sections/${section.id}`, {
      method: "DELETE",
    });
  }

  // Collapse duplicate block keys (e.g. "Produits mis en avant" created twice).
  const seenKeys = new Set<string>();
  for (const section of sections) {
    if (isRemovedBlock(section.body, section.title)) continue;
    const key = parseBlockKey(section.body, section.type);
    if (!key) continue;
    if (seenKeys.has(key)) {
      await proApi(`/api/workspaces/${tenantId}/site/pages/${home.id}/sections/${section.id}`, {
        method: "DELETE",
      });
      continue;
    }
    seenKeys.add(key);
  }

  // Drop unmarked leftovers that duplicate a known core title (ex. 2× « Produits mis en avant »).
  for (const section of sections) {
    if (isRemovedBlock(section.body, section.title)) continue;
    if (parseBlockKey(section.body, section.type)) continue;
    const title = (section.title || "").trim().toLowerCase();
    const duplicatesFeatured = /mis en avant/.test(title) && seenKeys.has("featured");
    const duplicatesAbout = /^à propos$/.test(title) && seenKeys.has("about");
    if (!duplicatesFeatured && !duplicatesAbout) continue;
    await proApi(`/api/workspaces/${tenantId}/site/pages/${home.id}/sections/${section.id}`, {
      method: "DELETE",
    });
  }

  const refreshed = await proApi<SiteData>(`/api/workspaces/${tenantId}/site`);
  const refreshedHome = refreshed.pages.find((page) => page.isHome);
  if (!refreshedHome) return refreshed;
  sections = [...refreshedHome.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const existingKeys = new Set(
    sections.map((section) => parseBlockKey(section.body, section.type)).filter(Boolean),
  );

  for (const preset of CORE_BLOCKS) {
    if (existingKeys.has(preset.key)) continue;

    const remapped = await remapExistingSection(tenantId, refreshedHome.id, sections, preset, site);
    if (remapped) {
      existingKeys.add(preset.key);
      continue;
    }

    await proApi(`/api/workspaces/${tenantId}/site/pages/${refreshedHome.id}/sections`, {
      method: "POST",
      body: JSON.stringify({
        type: preset.type,
        title: preset.title,
        body: withBlockMarker(
          preset.key,
          preset.key === "about" ? site.general.about || site.general.tagline : null,
        ),
        isVisible: preset.key !== "promotions",
        sortOrder: sections.length + existingKeys.size,
      }),
    });
    existingKeys.add(preset.key);
  }

  return proApi<SiteData>(`/api/workspaces/${tenantId}/site`);
}

async function remapExistingSection(
  tenantId: string,
  pageId: string,
  sections: Section[],
  preset: BlockPreset,
  site: SiteData,
) {
  let candidate: Section | undefined;

  if (preset.key === "hero") {
    candidate = sections.find((section) => section.type === "HERO" && !parseBlockKey(section.body, section.type));
  } else if (preset.key === "about") {
    candidate = sections.find(
      (section) =>
        section.type === "TEXT" &&
        !parseBlockKey(section.body, section.type) &&
        (!section.title || /^à propos$/i.test(section.title)),
    );
  } else if (preset.key === "featured") {
    candidate = sections.find(
      (section) =>
        !parseBlockKey(section.body, section.type) &&
        (section.type === "BANNER" || section.type === "TEXT") &&
        Boolean(section.title && /mis en avant/i.test(section.title)),
    );
  } else {
    candidate = sections.find(
      (section) =>
        !parseBlockKey(section.body, section.type) &&
        section.type === preset.type &&
        section.title === preset.title,
    );
  }

  if (!candidate) return false;

  await proApi(`/api/workspaces/${tenantId}/site/pages/${pageId}/sections/${candidate.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: candidate.title || preset.title,
      body: withBlockMarker(
        preset.key,
        stripBlockMarker(candidate.body) ||
          (preset.key === "about" ? site.general.about || site.general.tagline : null),
      ),
      isVisible: candidate.isVisible,
    }),
  });
  return true;
}
