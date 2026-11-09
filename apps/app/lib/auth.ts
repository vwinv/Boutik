import { withRequestLoading } from "./request-loading";

const AUTH_KEY = "boutik.auth";

export type ProSession = {
  accessToken: string;
  refreshToken: string;
};

export type ProMembership = {
  tenantId: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  category: string;
};

export type ProUser = {
  id: string;
  email: string;
  name: string;
  /** Espace pro actif (JWT), si défini. */
  tenantId?: string | null;
  memberships: ProMembership[];
};

/** Membership de l’espace courant : JWT d’abord, sinon boutique, sinon premier non archivé. */
export function activeProMembership(me: ProUser): ProMembership | null {
  const usable = me.memberships.filter((item) => item.status !== "ARCHIVED");
  if (!usable.length) return me.memberships[0] || null;
  if (me.tenantId) {
    const current = usable.find((item) => item.tenantId === me.tenantId);
    if (current) return current;
  }
  return usable.find((item) => item.category === "BOUTIQUE") || usable[0] || null;
}

let refreshInFlight: Promise<ProSession | null> | null = null;

export function readProSession(): ProSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY) || window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProSession>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

export function writeProSession(session: ProSession) {
  const payload = JSON.stringify(session);
  window.localStorage.setItem(AUTH_KEY, payload);
  window.sessionStorage.setItem(AUTH_KEY, payload);
}

export function clearProSession() {
  window.localStorage.removeItem(AUTH_KEY);
  window.sessionStorage.removeItem(AUTH_KEY);
}

/** Renouvelle l’access token via le refresh token (durée longue). */
export async function refreshProSession(): Promise<ProSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = readProSession();
    if (!current?.refreshToken) return null;
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const raw = await response.text();
      let body: {
        ok?: boolean;
        data?: { accessToken?: string; refreshToken?: string };
      } = {};
      try {
        body = raw ? (JSON.parse(raw) as typeof body) : {};
      } catch {
        clearProSession();
        return null;
      }
      if (!body.ok || !body.data?.accessToken || !body.data?.refreshToken) {
        clearProSession();
        return null;
      }
      const next = { accessToken: body.data.accessToken, refreshToken: body.data.refreshToken };
      writeProSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function fetchProMe(accessToken?: string): Promise<ProUser> {
  return withRequestLoading(async () => {
    const token = accessToken || readProSession()?.accessToken;
    if (!token) throw new Error("Session expirée.");

    const attempt = async (bearer: string) => {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      const raw = await response.text();
      let body: {
        ok?: boolean;
        data?: ProUser;
        error?: { message?: string; code?: string };
      } = {};
      try {
        body = raw ? (JSON.parse(raw) as typeof body) : {};
      } catch {
        throw new Error(
          response.status >= 500
            ? "Le serveur est indisponible. Réessaie dans un instant."
            : "Session invalide.",
        );
      }
      return { response, body };
    };

    let { response, body } = await attempt(token);
    if ((!body.ok || !body.data) && (response.status === 401 || body.error?.code === "UNAUTHORIZED")) {
      const refreshed = await refreshProSession();
      if (refreshed) {
        ({ response, body } = await attempt(refreshed.accessToken));
      }
    }
    if (!body.ok || !body.data) {
      throw new Error(body.error?.message || "Session expirée.");
    }
    return body.data;
  });
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function categoryLabel(category: string) {
  if (category === "RESTAURANT") return "Restaurant";
  if (category === "VITRINE") return "Site vitrine";
  return "Boutique";
}

export function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}
