import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { IdParamDto } from "../professionals/dto/id.param";
import { UpdatePlatformModuleDto } from "./dto/modules.dto";
import { ModulesService } from "./modules.service";

@Controller("admin/modules")
@RequireAudience("staff")
@StaffRoles("SUPPORT")
export class AdminModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  list() {
    return this.modules.listForAdmin();
  }

  @Patch(":id")
  @StaffRoles("ADMIN")
  update(@Param() params: IdParamDto, @Body() body: UpdatePlatformModuleDto) {
    return this.modules.updateForAdmin(params.id, body);
  }
}
