import { Body, Controller, Get, Headers, Logger, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { getWhatsappConfig } from "@boutik/config";
import { Public } from "../auth/decorators/public.decorator";
import { WhatsappConversationService } from "./whatsapp-conversation.service";

type WhatsappWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
          button?: { payload?: string; text?: string };
        }>;
      };
    }>;
  }>;
};

@Controller("webhooks/whatsapp")
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly conversation: WhatsappConversationService) {}

  @Public()
  @Get()
  verify(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() res: Response,
  ) {
    const expected = getWhatsappConfig().verifyToken;
    if (mode === "subscribe" && token === expected && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  @Public()
  @Post()
  async receive(
    @Body() body: WhatsappWebhookPayload,
    @Headers("x-hub-signature-256") _signature: string | undefined,
  ) {
    if (body.object !== "whatsapp_business_account") {
      return { ok: true };
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = value?.messages ?? [];
        if (!phoneNumberId || messages.length === 0) continue;
        const contactName = value?.contacts?.[0]?.profile?.name;

        for (const message of messages) {
          if (!message.from) continue;
          const buttonId =
            message.interactive?.button_reply?.id ||
            message.button?.payload ||
            undefined;
          const listId = message.interactive?.list_reply?.id;
          const text = message.text?.body;

          void this.conversation
            .handleIncoming({
              phoneNumberId,
              from: message.from,
              text,
              buttonId,
              listId,
              contactName,
            })
            .catch((err) =>
              this.logger.error(
                { err: err instanceof Error ? err.message : err },
                "Webhook WhatsApp non traité",
              ),
            );
        }
      }
    }

    return { ok: true };
  }
}
