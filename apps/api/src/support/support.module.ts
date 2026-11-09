import { Module } from "@nestjs/common";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { SupportService } from "./support.service";

@Module({
  imports: [ProNotificationsModule],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
