import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { ModulesModule } from "../modules/modules.module";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { AdminBillingController } from "./admin-billing.controller";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { BillingService } from "./billing.service";
import { SubscriptionLifecycleModule } from "./subscription-lifecycle.module";
import { WorkspaceBillingController } from "./workspace-billing.controller";

@Module({
  imports: [CatalogModule, ProfessionalsModule, ProNotificationsModule, SubscriptionLifecycleModule, ModulesModule],
  controllers: [AdminBillingController, AdminSubscriptionsController, WorkspaceBillingController],
  providers: [BillingService],
  exports: [SubscriptionLifecycleModule],
})
export class BillingModule {}
