import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { IdParamDto } from "./dto/id.param";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ProfessionalsService } from "./professionals.service";
import { WorkspacesService } from "./workspaces.service";

@Controller("professionals")
@RequireAudience("pro")
export class ProfessionalsController {
  constructor(
    private readonly professionals: ProfessionalsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.professionals.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateProfessionalDto) {
    return this.professionals.create(user.id, body);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.professionals.getMine(user.id, params.id);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param() params: IdParamDto, @Body() body: UpdateProfessionalDto) {
    return this.professionals.updateMine(user.id, params.id, body);
  }

  @Post(":id/workspaces")
  createWorkspace(
    @CurrentUser() user: RequestUser,
    @Param() params: IdParamDto,
    @Body() body: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(user.id, params.id, body);
  }
}
