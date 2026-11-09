import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getPublicOrigin, ports, tenantSlugFromHost, workspaceSlugFromHost } from "./site";

export type NodeEnv = "development" | "test" | "production";

export {
  getPublicOrigin,
  getRootHostname,
  hostnameFromHeader as hostnameFromHost,
  ports,
  routes,
  siteHost,
  sitePath,
  siteUrl,
  tenantSlugFromHost,
  workspaceHost,
  workspaceSlugFromHost,
  workspaceUrl,
} from "./site";

export function getApiUrl() {
  return process.env.API_URL ?? `http://localhost:${ports.api}`;
}

export function getApiPort() {
  const raw = process.env.API_PORT;
  return raw ? Number(raw) : ports.api;
}

export function getNodeEnv(): NodeEnv {
  const value = process.env.NODE_ENV;
  if (value === "production" || value === "test") {
    return value;
  }
  return "development";
}

export function isProduction() {
  return getNodeEnv() === "production";
}

export function isTest() {
  return getNodeEnv() === "test";
}

export function getLogLevel() {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }

  if (getNodeEnv() === "production") {
    return "info";
  }

  if (getNodeEnv() === "test") {
    return "error";
  }

  return "debug";
}

export function resolveEnvFiles(cwd = process.cwd()) {
  const env = getNodeEnv();
  const roots = [...new Set([cwd, resolve(cwd, "../..")])];
  const names = [`.env.${env}.local`, `.env.${env}`, env === "test" ? undefined : ".env.local", ".env"].filter(
    (name): name is string => Boolean(name),
  );

  const files: string[] = [];
  for (const root of roots) {
    for (const name of names) {
      const file = resolve(root, name);
      if (existsSync(file) && !files.includes(file)) {
        files.push(file);
      }
    }
  }

  return files;
}

export function assertRequiredEnv() {
  const missing = ["DATABASE_URL", "PUBLIC_ORIGIN"].filter((key) => !process.env[key]);

  if (getNodeEnv() === "production") {
    if (!process.env.API_URL) {
      missing.push("API_URL");
    }
    if (!process.env.JWT_ACCESS_SECRET) {
      missing.push("JWT_ACCESS_SECRET");
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      missing.push("JWT_REFRESH_SECRET");
    }
  }

  if (isSmtpEnabled()) {
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"]) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
  }
}

export function getJwtAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) {
    return secret;
  }
  if (isProduction()) {
    throw new Error("JWT_ACCESS_SECRET manquant");
  }
  return "boutik-dev-access-secret";
}

export function getJwtRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (secret) {
    return secret;
  }
  if (isProduction()) {
    throw new Error("JWT_REFRESH_SECRET manquant");
  }
  return "boutik-dev-refresh-secret";
}

export function getJwtAccessTtlSeconds() {
  return Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 3600);
}

export function getJwtRefreshTtlSeconds() {
  return Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 30);
}

export function isSmtpEnabled() {
  return process.env.SMTP_ENABLED === "true";
}

export function isPaydunyaEnabled() {
  return process.env.PAYDUNYA_ENABLED === "true";
}

export function getPaydunyaConfig() {
  const mode = process.env.PAYDUNYA_MODE === "live" ? "live" : "test";
  const countryRaw = (process.env.PAYDUNYA_COUNTRY || "ci").trim().toLowerCase();
  const country = countryRaw === "sn" ? "sn" : "ci";
  return {
    enabled: isPaydunyaEnabled(),
    mode,
    country: country as "ci" | "sn",
    masterKey: process.env.PAYDUNYA_MASTER_KEY?.trim() || "",
    privateKey: process.env.PAYDUNYA_PRIVATE_KEY?.trim() || "",
    token: process.env.PAYDUNYA_TOKEN?.trim() || "",
    storeName: process.env.PAYDUNYA_STORE_NAME?.trim() || "Boutik",
    baseUrl:
      mode === "live"
        ? "https://app.paydunya.com/api/v1"
        : "https://app.paydunya.com/sandbox-api/v1",
    /** API PUSH / cashout (déboursement) — v2 */
    disburseBaseUrl:
      mode === "live"
        ? "https://app.paydunya.com/api/v2"
        : "https://app.paydunya.com/sandbox-api/v2",
  };
}

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";
  return {
    enabled: Boolean(cloudName && apiKey && apiSecret),
    cloudName,
    apiKey,
    apiSecret,
    folderRoot: process.env.CLOUDINARY_FOLDER_ROOT?.trim() || "Boutik",
  };
}

export function isEsmsEnabled() {
  return process.env.ESMS_ENABLED === "true";
}

export function getEsmsConfig() {
  const apiKey = process.env.ESMS_API_KEY?.trim() || "";
  return {
    enabled: isEsmsEnabled() && Boolean(apiKey),
    apiKey,
    senderId: process.env.ESMS_SENDER_ID?.trim() || "Boutik",
    baseUrl: (process.env.ESMS_BASE_URL?.trim() || "https://sms.esmsafrica.io").replace(/\/$/, ""),
  };
}

export function getWhatsappConfig() {
  return {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "boutik-whatsapp-verify",
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v21.0",
    graphBaseUrl: (process.env.WHATSAPP_GRAPH_URL?.trim() || "https://graph.facebook.com").replace(/\/$/, ""),
  };
}

export function getMailFrom() {
  return process.env.MAIL_FROM?.trim() || "Boutik <noreply@localhost>";
}

export function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: getMailFrom(),
  };
}

export function getAllowedOrigins() {
  const origins = new Set<string>();
  origins.add(getPublicOrigin().replace(/\/$/, ""));

  for (const origin of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const trimmed = origin.trim();
    if (trimmed.length > 0 && trimmed !== "*") {
      origins.add(trimmed.replace(/\/$/, ""));
    }
  }

  if (!isProduction()) {
    for (const port of [ports.marketing, ports.admin, ports.app, ports.web]) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
  }

  return [...origins];
}

export function isAllowedOrigin(origin: string) {
  const normalized = origin.replace(/\/$/, "");
  if (getAllowedOrigins().includes(normalized)) {
    return true;
  }

  try {
    const host = new URL(normalized).host;
    return Boolean(tenantSlugFromHost(host) || workspaceSlugFromHost(host));
  } catch {
    return false;
  }
}
