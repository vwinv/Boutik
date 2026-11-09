const AUTH_KEY = "boutik.staff.auth";

export type StaffSession = {
  accessToken: string;
  refreshToken: string;
};

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  staffRole: string;
};

export function readStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY) || window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StaffSession>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

export function writeStaffSession(session: StaffSession) {
  const payload = JSON.stringify(session);
  window.localStorage.setItem(AUTH_KEY, payload);
  window.sessionStorage.setItem(AUTH_KEY, payload);
}

export function clearStaffSession() {
  window.localStorage.removeItem(AUTH_KEY);
  window.sessionStorage.removeItem(AUTH_KEY);
}

export async function staffLogin(email: string, password: string) {
  const response = await fetch("/api/auth/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const raw = await response.text();
  let body: {
    ok?: boolean;
    data?: { accessToken: string; refreshToken: string; user: StaffUser };
    error?: { message?: string };
  } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    throw new Error(
      response.status >= 500 || !raw
        ? "Le serveur est indisponible. Réessaie dans un instant."
        : "Réponse serveur invalide.",
    );
  }
  if (!body.ok || !body.data?.accessToken || !body.data?.refreshToken) {
    throw new Error(body.error?.message || "Identifiants incorrects.");
  }
  writeStaffSession({
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
  });
  return body.data;
}

export async function fetchStaffMe(): Promise<StaffUser> {
  const session = readStaffSession();
  if (!session) throw new Error("Non connecté");
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const raw = await response.text();
  let body: { ok?: boolean; data?: StaffUser; error?: { message?: string } } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    throw new Error("Session invalide.");
  }
  if (!body.ok || !body.data) {
    clearStaffSession();
    throw new Error(body.error?.message || "Session expirée.");
  }
  return body.data;
}
