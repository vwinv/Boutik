import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import type { RequestUser } from "../auth/auth.types";
import { SetTenantModuleDto } from "./dto/modules.dto";
import { ModulesService } from "./modules.service";

class WorkspaceModulesParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

class WorkspaceModuleParamDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  moduleId!: string;
}

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get(":id/modules")
  list(@CurrentUser() user: RequestUser, @Param() params: WorkspaceModulesParamDto) {
    return this.modules.listForWorkspace(user.id, params.id);
  }

  @Put(":id/modules/:moduleId")
  set(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceModuleParamDto,
    @Body() body: SetTenantModuleDto,
  ) {
    return this.modules.setForWorkspace(user.id, params.id, params.moduleId, body);
  }
}
