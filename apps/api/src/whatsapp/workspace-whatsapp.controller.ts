import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { UpsertWhatsappConfigDto } from "./dto/whatsapp.dto";
import { WhatsappConfigService } from "./whatsapp-config.service";

class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceWhatsappController {
  constructor(private readonly whatsapp: WhatsappConfigService) {}

  @Get(":id/whatsapp")
  get(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.whatsapp.getForWorkspace(user.id, params.id);
  }

  @Put(":id/whatsapp")
  upsert(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UpsertWhatsappConfigDto,
  ) {
    return this.whatsapp.upsertForWorkspace(user.id, params.id, body);
  }
}
