import { Module } from "@nestjs/common";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { AdminWalletsController } from "./admin-wallets.controller";
import { AdminWalletsService } from "./admin-wallets.service";
import { AdminWithdrawalsController } from "./admin-withdrawals.controller";
import { AdminWithdrawalsService } from "./admin-withdrawals.service";
import { WalletService } from "./wallet.service";

@Module({
  imports: [ProNotificationsModule],
  controllers: [AdminWalletsController, AdminWithdrawalsController],
  providers: [WalletService, AdminWalletsService, AdminWithdrawalsService],
  exports: [WalletService],
})
export class WalletModule {}
