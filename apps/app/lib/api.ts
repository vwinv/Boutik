import { clearProSession, readProSession, refreshProSession } from "./auth";
import { withRequestLoading } from "./request-loading";

export async function proApi<T>(path: string, init?: RequestInit): Promise<T> {
  return withRequestLoading(async () => {
    const run = async (accessToken: string) => {
      const headers = new Headers(init?.headers || {});
      headers.set("Authorization", `Bearer ${accessToken}`);
      if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(path, {
        ...init,
        headers,
      });
      const raw = await response.text();
      let body: {
        ok?: boolean;
        data?: T;
        error?: { message?: string; code?: string; details?: Array<{ field?: string; messages?: string[] }> };
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
      return { response, body };
    };

    const session = readProSession();
    if (!session) throw new Error("Non connecté");

    let { response, body } = await run(session.accessToken);
    if ((!body.ok || body.data === undefined) && (response.status === 401 || body.error?.code === "UNAUTHORIZED")) {
      const refreshed = await refreshProSession();
      if (refreshed) {
        ({ response, body } = await run(refreshed.accessToken));
      } else {
        clearProSession();
      }
    }

    if (!body.ok || body.data === undefined) {
      const details = body.error?.details
        ?.map((item) => `${item.field ?? "?"}: ${(item.messages ?? []).join(", ")}`)
        .filter(Boolean)
        .join(" · ");
      throw new Error(details || body.error?.message || "Requête impossible");
    }
    return body.data;
  });
}

export async function proUpload<T>(path: string, form: FormData): Promise<T> {
  return proApi<T>(path, { method: "POST", body: form });
}
