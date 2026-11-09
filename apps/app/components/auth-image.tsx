"use client";

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { readProSession } from "../lib/auth";

/**
 * Charge une image protégée (Bearer) — les balises <img> n’envoient pas l’Authorization.
 */
export function AuthImage({
  src,
  fallback,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      setFailed(false);
      if (!src) {
        setResolved(null);
        return;
      }
      if (/^(https?:|data:|blob:)/i.test(src)) {
        setResolved(src);
        return;
      }

      const session = readProSession();
      if (!session) {
        setFailed(true);
        setResolved(null);
        return;
      }

      try {
        const response = await fetch(src, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setResolved(objectUrl);
      } catch {
        if (active) {
          setFailed(true);
          setResolved(null);
        }
      }
    }

    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !resolved) {
    return <>{fallback ?? null}</>;
  }

  return <img src={resolved} alt={props.alt ?? ""} {...props} />;
}
