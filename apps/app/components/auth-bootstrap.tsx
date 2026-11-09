"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { writeProSession } from "../lib/auth";

/** Récupère les tokens passés en hash depuis /connexion (origine différente). */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    consumeWorkspaceAuthHash();
  }, []);
  return children;
}

export function consumeWorkspaceAuthHash() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  if (!hash.startsWith("#boutik_auth=")) return false;
  try {
    const raw = decodeURIComponent(hash.slice("#boutik_auth=".length));
    const parsed = JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
    if (!parsed.accessToken || !parsed.refreshToken) return false;
    writeProSession({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return true;
  } catch {
    return false;
  }
}
