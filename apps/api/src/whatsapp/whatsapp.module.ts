import { Module } from "@nestjs/common";
import { ModulesModule } from "../modules/modules.module";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { WhatsappCloudService } from "./whatsapp-cloud.service";
import { WhatsappConfigService } from "./whatsapp-config.service";
import { WhatsappConversationService } from "./whatsapp-conversation.service";
import { WhatsappWebhookController } from "./whatsapp-webhook.controller";
import { WorkspaceWhatsappController } from "./workspace-whatsapp.controller";

@Module({
  imports: [ProfessionalsModule, ModulesModule, ProNotificationsModule],
  controllers: [WhatsappWebhookController, WorkspaceWhatsappController],
  providers: [WhatsappCloudService, WhatsappConversationService, WhatsappConfigService],
  exports: [WhatsappConfigService, WhatsappCloudService],
})
export class WhatsappModule {}
