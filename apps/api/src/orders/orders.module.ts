import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ModulesModule } from "../modules/modules.module";
import { ProNotificationsModule } from "../notifications/pro-notifications.module";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { WalletModule } from "../wallet/wallet.module";
import { OrdersService } from "./orders.service";
import { PaydunyaService } from "./paydunya.service";
import { StorefrontOrdersController } from "./storefront-orders.controller";
import { WorkspaceOrdersController } from "./workspace-orders.controller";

@Module({
  imports: [ProfessionalsModule, AuthModule, WalletModule, ProNotificationsModule, ModulesModule],
  controllers: [StorefrontOrdersController, WorkspaceOrdersController],
  providers: [OrdersService, PaydunyaService],
})
export class OrdersModule {}
