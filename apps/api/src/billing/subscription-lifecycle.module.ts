import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

@Module({
  imports: [CatalogModule, ProNotificationsModule],
  providers: [SubscriptionLifecycleService],
  exports: [SubscriptionLifecycleService],
})
export class SubscriptionLifecycleModule {}
