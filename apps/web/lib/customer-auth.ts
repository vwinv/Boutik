export type CustomerSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
};

export function customerIdentityFromSession(session: CustomerSession) {
  return {
    name: session.user.name?.trim() || "",
    email: session.user.email?.trim().toLowerCase() || "",
    phone: session.user.phone?.trim() || "",
  };
}

function storageKey(slug: string) {
  return `boutik.customer.${slug}`;
}

export function readCustomerSession(slug: string): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed?.accessToken || !parsed?.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCustomerSession(slug: string, session: CustomerSession) {
  window.localStorage.setItem(storageKey(slug), JSON.stringify(session));
}

export function clearCustomerSession(slug: string) {
  window.localStorage.removeItem(storageKey(slug));
}

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string; code?: string; details?: { messages?: string[] }[] };
};

type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: CustomerSession["user"];
};

function toCustomerSession(data: AuthSessionPayload): CustomerSession {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone ?? null,
    },
  };
}

/** Renouvelle l’access token client ; retourne null si la session est morte. */
export async function refreshCustomerSession(slug: string, session?: CustomerSession | null) {
  const current = session ?? readCustomerSession(slug);
  if (!current?.refreshToken) {
    clearCustomerSession(slug);
    return null;
  }
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    const payload = (await response.json()) as ApiEnvelope<AuthSessionPayload>;
    if (!payload.ok || !payload.data?.accessToken) {
      clearCustomerSession(slug);
      return null;
    }
    const next = toCustomerSession(payload.data);
    writeCustomerSession(slug, next);
    return next;
  } catch {
    clearCustomerSession(slug);
    return null;
  }
}

export async function customerAuthRequest<T>(
  path: "customers/login" | "customers/register" | "logout",
  body: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Le serveur ne répond pas.");
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("Réponse du serveur illisible.");
  }

  if (!payload.ok || payload.data === undefined) {
    const detail = payload.error?.details?.find((item) => item.messages?.[0])?.messages?.[0];
    throw new Error(detail || payload.error?.message || "Une erreur est survenue.");
  }

  return payload.data;
}

/** Appels authentifiés compte client (ex. PATCH /me) avec refresh auto. */
export async function customerAuthedRequest<T>(
  slug: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const run = async (accessToken: string) => {
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(path, { ...init, headers });
    const raw = await response.text();
    let payload: ApiEnvelope<T> = {};
    try {
      payload = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
    } catch {
      throw new Error("Réponse du serveur illisible.");
    }
    return { response, payload };
  };

  let session = readCustomerSession(slug);
  if (!session?.accessToken) throw new Error("Non connecté");

  let { response, payload } = await run(session.accessToken);
  if ((!payload.ok || payload.data === undefined) && (response.status === 401 || payload.error?.code === "UNAUTHORIZED")) {
    session = await refreshCustomerSession(slug, session);
    if (!session) throw new Error("Session expirée. Reconnectez-vous.");
    ({ response, payload } = await run(session.accessToken));
  }

  if (!payload.ok || payload.data === undefined) {
    const detail = payload.error?.details?.find((item) => item.messages?.[0])?.messages?.[0];
    throw new Error(detail || payload.error?.message || "Une erreur est survenue.");
  }
  return payload.data;
}
