import { Controller, Get, Param } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { TenantSlugParamDto } from "./dto/tenant-slug.param";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @RequireAudience("staff")
  @StaffRoles("SUPPORT")
  @Get()
  list() {
    return this.tenants.list();
  }

  @Public()
  @Get("by-slug/:slug")
  findBySlug(@Param() params: TenantSlugParamDto) {
    return this.tenants.findBySlug(params.slug);
  }
}
