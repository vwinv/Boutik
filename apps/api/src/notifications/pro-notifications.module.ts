import { Module } from "@nestjs/common";
import { ProNotificationsService } from "./pro-notifications.service";

@Module({
  providers: [ProNotificationsService],
  exports: [ProNotificationsService],
})
export class ProNotificationsModule {}
