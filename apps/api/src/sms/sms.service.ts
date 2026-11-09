import { Injectable, Logger } from "@nestjs/common";
import { getEsmsConfig } from "@boutik/config";

export type SmsSendResult = {
  ok: boolean;
  skipped?: boolean;
  providerId?: string;
  error?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /** Envoi via eSMS Africa. Sans clé / désactivé → log uniquement (dev). */
  async send(to: string, text: string): Promise<SmsSendResult> {
    const phone = normalizeE164(to);
    if (!phone) {
      return { ok: false, error: "Numéro invalide" };
    }

    const config = getEsmsConfig();
    if (!config.enabled) {
      this.logger.warn({ phone, text }, "SMS non envoyé (eSMS désactivé)");
      return { ok: true, skipped: true };
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          text,
          sender_id: config.senderId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            id?: string;
            status?: string;
            message?: string;
            error?: string | { code?: string; message?: string; details?: unknown };
            code?: string;
          }
        | null;

      if (!response.ok) {
        const error = formatEsmsError(body) || `HTTP ${response.status}`;
        this.logger.error({ phone, error, body, status: response.status }, "Échec envoi eSMS");
        return { ok: false, error };
      }

      this.logger.log({ phone, id: body?.id, status: body?.status }, "SMS envoyé via eSMS");
      return { ok: true, providerId: body?.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erreur réseau eSMS";
      this.logger.error({ phone, error }, "Exception eSMS");
      return { ok: false, error };
    }
  }
}

function normalizeE164(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+") && cleaned.length >= 10) return cleaned;
  if (/^\d{8,15}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

function formatEsmsError(body: {
  message?: string;
  error?: string | { code?: string; message?: string };
  code?: string;
} | null) {
  if (!body) return null;
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (body.error && typeof body.error === "object") {
    const nested = body.error.message || body.error.code;
    if (nested) return nested;
  }
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.code === "string" && body.code.trim()) return body.code;
  return null;
}
