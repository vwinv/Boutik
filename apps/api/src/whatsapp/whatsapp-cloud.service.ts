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
