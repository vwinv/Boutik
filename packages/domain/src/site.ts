import { isReservedSlug } from "./reserved-slugs";
import { WEEKDAYS, type SitePublicStatus, type SiteSectionType, type SiteStatus, type TenantStatus } from "./types";

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyName(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return PUBLIC_SLUG_PATTERN.test(slug) ? slug : "";
}

export function isPublicSlug(value: string) {
  return PUBLIC_SLUG_PATTERN.test(value) && value.length >= 3 && value.length <= 48 && !isReservedSlug(value);
}

export function nextAvailableSlug(base: string, taken: Iterable<string>) {
  const used = new Set([...taken].map((item) => item.toLowerCase()));
  const normalized = isPublicSlug(base) ? base : slugifyName(base);
  if (!normalized) {
    return "";
  }
  if (!used.has(normalized)) {
    return normalized;
  }

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${normalized.slice(0, Math.max(3, 48 - suffix.length))}${suffix}`;
    if (isPublicSlug(candidate) && !used.has(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function sitePublicStatus(tenantStatus: TenantStatus, siteStatus?: SiteStatus | null): SitePublicStatus {
  if (tenantStatus === "ARCHIVED") {
    return "ARCHIVED";
  }
  if (tenantStatus === "SUSPENDED") {
    return "SUSPENDED";
  }
  if (siteStatus === "SUSPENDED") {
    return "SUSPENDED";
  }
  if (siteStatus === "PUBLISHED") {
    return "PUBLISHED";
  }
  return "DRAFT";
}

export function isSitePubliclyVisible(status: SitePublicStatus) {
  return status === "PUBLISHED";
}

export function sectionCapability(type: SiteSectionType) {
  if (type === "GALLERY") {
    return "gallery";
  }
  if (type === "HOURS") {
    return "hours";
  }
  return "pages";
}

export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultOpeningHours() {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    isClosed: weekday === 7,
    opensAt: weekday === 7 ? null : weekday === 6 ? "10:00" : "09:00",
    closesAt: weekday === 7 ? null : weekday === 6 ? "14:00" : "18:00",
  }));
}

export function defaultSitePages(name: string) {
  return [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sortOrder: 0,
      sections: [
        { type: "HERO" as const, title: name, body: `Bienvenue chez ${name}`, sortOrder: 0 },
        { type: "TEXT" as const, title: "À propos", body: null, sortOrder: 1 },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      isHome: false,
      sortOrder: 1,
      sections: [{ type: "CONTACT" as const, title: "Nous contacter", body: null, sortOrder: 0 }],
    },
  ];
}
