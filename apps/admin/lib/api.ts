import { clearStaffSession, readStaffSession } from "./auth";

export async function staffApi<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readStaffSession();
  if (!session) throw new Error("Non connecté");

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const raw = await response.text();
  let body: {
    ok?: boolean;
    data?: T;
    error?: { message?: string; code?: string };
  } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    throw new Error(
      response.status >= 500
        ? "Le serveur est indisponible. Réessaie dans un instant."
        : raw.slice(0, 120) || "Réponse serveur invalide",
    );
  }

  if (response.status === 401 || body.error?.code === "UNAUTHORIZED") {
    clearStaffSession();
    window.location.assign("/admin");
    throw new Error("Session expirée.");
  }

  if (!body.ok || body.data === undefined) {
    throw new Error(body.error?.message || "Requête impossible.");
  }
  return body.data;
}
