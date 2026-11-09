import { Module } from "@nestjs/common";
import { SupportModule } from "../support/support.module";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminSupportController } from "./admin-support.controller";
import { AdminTenantsController } from "./admin-tenants.controller";
import { AdminTenantsService } from "./admin-tenants.service";

@Module({
  imports: [SupportModule],
  controllers: [AdminTenantsController, AdminSupportController],
  providers: [AdminTenantsService, AdminDashboardService],
})
export class AdminTenantsModule {}
