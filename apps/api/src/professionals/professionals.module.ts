import { Module } from "@nestjs/common";
import { SubscriptionLifecycleModule } from "../billing/subscription-lifecycle.module";
import { CatalogModule } from "../catalog/catalog.module";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { SupportModule } from "../support/support.module";
import { WalletModule } from "../wallet/wallet.module";
import { CloudinaryMediaStorage } from "./cloudinary-media.storage";
import { DocumentsStorage } from "./documents.storage";
import { ProfessionalsController } from "./professionals.controller";
import { ProfessionalsService } from "./professionals.service";
import { TenantAccessService } from "./tenant-access.service";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [CatalogModule, WalletModule, ProNotificationsModule, SupportModule, SubscriptionLifecycleModule],
  controllers: [ProfessionalsController, WorkspacesController],
  providers: [ProfessionalsService, WorkspacesService, TenantAccessService, DocumentsStorage, CloudinaryMediaStorage],
  exports: [TenantAccessService, DocumentsStorage, CloudinaryMediaStorage],
})
export class ProfessionalsModule {}
