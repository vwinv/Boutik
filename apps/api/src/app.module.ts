import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { AuthGuard } from "./auth/guards/auth.guard";
import { AudienceGuard } from "./auth/guards/audience.guard";
import { StaffRolesGuard } from "./auth/guards/staff-roles.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AdminUsersModule } from "./admin/admin-users.module";
import { AdminTenantsModule } from "./admin/admin-tenants.module";
import { BillingModule } from "./billing/billing.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ProfessionalsModule } from "./professionals/professionals.module";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { SitesModule } from "./sites/sites.module";
import { WalletModule } from "./wallet/wallet.module";
import { ModulesModule } from "./modules/modules.module";
import { SmsModule } from "./sms/sms.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { resolveEnvFiles } from "@boutik/config";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { loggerModule } from "./common/logger.module";
import { ResponseInterceptor } from "./common/response.interceptor";
import { createValidationPipe } from "./common/validation";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenantsModule } from "./tenants/tenants.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFiles(),
    }),
    loggerModule,
    PrismaModule,
    SmsModule,
    HealthModule,
    TenantsModule,
    AuthModule,
    UsersModule,
    AdminUsersModule,
    AdminTenantsModule,
    CatalogModule,
    BillingModule,
    WalletModule,
    ProfessionalsModule,
    SitesModule,
    ProductsModule,
    ReservationsModule,
    OrdersModule,
    ModulesModule,
    WhatsappModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: createValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AudienceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: StaffRolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
