import { Injectable, Logger } from "@nestjs/common";
import { getWhatsappConfig } from "@boutik/config";

type WaTarget = {
  phoneNumberId: string;
  accessToken: string;
  to: string;
};

type SendTextInput = WaTarget & {
  text: string;
};

type InteractiveButton = { id: string; title: string };

type SendButtonsInput = WaTarget & {
  body: string;
  buttons: InteractiveButton[];
  footer?: string;
};

type ListRow = { id: string; title: string; description?: string };

type SendListInput = WaTarget & {
  body: string;
  buttonText: string;
  sections: Array<{ title: string; rows: ListRow[] }>;
  footer?: string;
};

@Injectable()
export class WhatsappCloudService {
  private readonly logger = new Logger(WhatsappCloudService.name);

  async sendText(input: SendTextInput) {
    return this.send(input.phoneNumberId, input.accessToken, {
      messaging_product: "whatsapp",
      to: normalizeWaTo(input.to),
      type: "text",
      text: { body: input.text },
    });
  }

  async sendButtons(input: SendButtonsInput) {
    return this.send(input.phoneNumberId, input.accessToken, {
      messaging_product: "whatsapp",
      to: normalizeWaTo(input.to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: input.body },
        ...(input.footer ? { footer: { text: input.footer } } : {}),
        action: {
          buttons: input.buttons.slice(0, 3).map((button) => ({
            type: "reply",
            reply: { id: button.id, title: clip(button.title, 20) },
          })),
        },
      },
    });
  }

  async verifyCredentials(input: { phoneNumberId: string; accessToken: string }) {
    const config = getWhatsappConfig();
    const url = `${config.graphBaseUrl}/${config.apiVersion}/${input.phoneNumberId}?fields=display_phone_number,verified_name`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { display_phone_number?: string; verified_name?: string; error?: { message?: string } }
        | null;
      if (!response.ok) {
        return { ok: false as const, error: payload?.error?.message || `HTTP ${response.status}` };
      }
      const raw = payload?.display_phone_number?.replace(/[^\d+]/g, "") || "";
      const displayPhone = raw.startsWith("+") ? raw : raw ? `+${raw}` : undefined;
      return {
        ok: true as const,
        displayPhone,
        verifiedName: payload?.verified_name,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Erreur réseau WhatsApp",
      };
    }
  }

  /** Récupère les WABA IDs accordés au token (granular_scopes), utile si le postMessage Meta est incomplet. */
  async discoverWabaIdsFromToken(input: { accessToken: string }) {
    const config = getWhatsappConfig();
    const appToken = `${config.appId}|${config.appSecret}`;
    const url = new URL(`${config.graphBaseUrl}/${config.apiVersion}/debug_token`);
    url.searchParams.set("input_token", input.accessToken);
    url.searchParams.set("access_token", appToken);
    try {
      const response = await fetch(url.toString());
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              is_valid?: boolean;
              granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
              error?: { message?: string };
            };
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        return {
          ok: false as const,
          error: payload?.error?.message || payload?.data?.error?.message || `HTTP ${response.status}`,
          wabaIds: [] as string[],
        };
      }
      if (payload?.data?.is_valid === false) {
        return { ok: false as const, error: "Token Meta invalide", wabaIds: [] as string[] };
      }
      const wabaIds = new Set<string>();
      for (const scope of payload?.data?.granular_scopes || []) {
        const name = scope.scope || "";
        if (
          name.includes("whatsapp_business") ||
          name === "whatsapp_business_management" ||
          name === "whatsapp_business_messaging"
        ) {
          for (const id of scope.target_ids || []) {
            if (id) wabaIds.add(id);
          }
        }
      }
      return { ok: true as const, wabaIds: [...wabaIds] };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Erreur réseau WhatsApp",
        wabaIds: [] as string[],
      };
    }
  }

  async listWabaPhoneNumbers(input: { wabaId: string; accessToken: string }) {
    const config = getWhatsappConfig();
    const url = `${config.graphBaseUrl}/${config.apiVersion}/${input.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }>;
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        return {
          ok: false as const,
          error: payload?.error?.message || `HTTP ${response.status}`,
          phones: [] as Array<{ id: string; displayPhone?: string; verifiedName?: string }>,
        };
      }
      const phones = (payload?.data || [])
        .filter((row): row is { id: string; display_phone_number?: string; verified_name?: string } =>
          Boolean(row.id),
        )
        .map((row) => {
          const raw = row.display_phone_number?.replace(/[^\d+]/g, "") || "";
          const displayPhone = raw ? (raw.startsWith("+") ? raw : `+${raw}`) : undefined;
          return { id: row.id, displayPhone, verifiedName: row.verified_name };
        });
      return { ok: true as const, phones };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Erreur réseau WhatsApp",
        phones: [] as Array<{ id: string; displayPhone?: string; verifiedName?: string }>,
      };
    }
  }

  /** Abonne l’app Boutik aux webhooks du WABA du commerçant. */
  async subscribeWaba(input: { wabaId: string; accessToken: string }) {
    const config = getWhatsappConfig();
    const url = `${config.graphBaseUrl}/${config.apiVersion}/${input.wabaId}/subscribed_apps`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;
      if (!response.ok) {
        const error = payload?.error?.message || `HTTP ${response.status}`;
        this.logger.warn({ wabaId: input.wabaId, error }, "Subscribe WABA échoué");
        return { ok: false as const, error };
      }
      return { ok: true as const };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erreur réseau WhatsApp";
      this.logger.warn({ wabaId: input.wabaId, error }, "Subscribe WABA exception");
      return { ok: false as const, error };
    }
  }

  async sendList(input: SendListInput) {
    return this.send(input.phoneNumberId, input.accessToken, {
      messaging_product: "whatsapp",
      to: normalizeWaTo(input.to),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.body },
        ...(input.footer ? { footer: { text: input.footer } } : {}),
        action: {
          button: clip(input.buttonText, 20),
          sections: input.sections.map((section) => ({
            title: clip(section.title, 24),
            rows: section.rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: clip(row.title, 24),
              ...(row.description ? { description: clip(row.description, 72) } : {}),
            })),
          })),
        },
      },
    });
  }

  private async send(phoneNumberId: string, accessToken: string, body: Record<string, unknown>) {
    const config = getWhatsappConfig();
    const url = `${config.graphBaseUrl}/${config.apiVersion}/${phoneNumberId}/messages`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } }
        | null;
      if (!response.ok) {
        const error = payload?.error?.message || `HTTP ${response.status}`;
        this.logger.error({ phoneNumberId, error, payload }, "Échec envoi WhatsApp");
        return { ok: false as const, error };
      }
      return { ok: true as const, messageId: payload?.messages?.[0]?.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erreur réseau WhatsApp";
      this.logger.error({ phoneNumberId, error }, "Exception WhatsApp");
      return { ok: false as const, error };
    }
  }
}

function normalizeWaTo(value: string) {
  return value.replace(/[^\d]/g, "");
}

function clip(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}
