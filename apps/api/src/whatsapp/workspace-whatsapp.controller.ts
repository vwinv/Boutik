import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  EmbeddedSignupDto,
  UpdateWhatsappShopDto,
  UpsertWhatsappConfigDto,
} from "./dto/whatsapp.dto";
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

  @Patch(":id/whatsapp")
  updateShop(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UpdateWhatsappShopDto,
  ) {
    return this.whatsapp.updateShopSettings(user.id, params.id, body);
  }

  @Post(":id/whatsapp/embedded-signup")
  embeddedSignup(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: EmbeddedSignupDto,
  ) {
    return this.whatsapp.completeEmbeddedSignup(user.id, params.id, body);
  }

  @Post(":id/whatsapp/test")
  test(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.whatsapp.testConnection(user.id, params.id);
  }

  @Delete(":id/whatsapp")
  disconnect(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.whatsapp.disconnect(user.id, params.id);
  }
}
