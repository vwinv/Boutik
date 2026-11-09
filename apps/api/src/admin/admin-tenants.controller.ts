import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { IdParamDto } from "../professionals/dto/id.param";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminTenantsService } from "./admin-tenants.service";
import { SuspendTenantDto } from "./dto/suspend-tenant.dto";

@Controller("admin")
@RequireAudience("staff")
export class AdminTenantsController {
  constructor(
    private readonly tenants: AdminTenantsService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  @StaffRoles("SUPPORT")
  @Get("dashboard")
  overview() {
    return this.dashboard.overview();
  }

  @StaffRoles("SUPPORT")
  @Get("espaces")
  listEspaces() {
    return this.tenants.listEspaces();
  }

  @StaffRoles("SUPPORT")
  @Get("professionals")
  listProfessionals() {
    return this.tenants.listProfessionals();
  }

  @StaffRoles("SUPPORT")
  @Get("professionals/:id")
  getProfessional(@Param() params: IdParamDto) {
    return this.tenants.getProfessional(params.id);
  }

  @StaffRoles("SUPPORT")
  @Get("tenants")
  listTenants() {
    return this.tenants.listTenants();
  }

  @StaffRoles("SUPPORT")
  @Get("tenants/:id")
  getTenant(@Param() params: IdParamDto) {
    return this.tenants.getTenant(params.id);
  }

  @StaffRoles("ADMIN")
  @Post("tenants/:id/suspend")
  suspend(@Param() params: IdParamDto, @Body() body: SuspendTenantDto) {
    return this.tenants.suspend(params.id, body.reason);
  }

  @StaffRoles("ADMIN")
  @Post("tenants/:id/reactivate")
  reactivate(@Param() params: IdParamDto) {
    return this.tenants.reactivate(params.id);
  }

  @StaffRoles("ADMIN")
  @Post("tenants/:id/archive")
  archive(@Param() params: IdParamDto) {
    return this.tenants.archive(params.id);
  }
}
