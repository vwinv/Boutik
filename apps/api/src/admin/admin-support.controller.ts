import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import type { RequestUser } from "../auth/auth.types";
import { SupportService } from "../support/support.service";
import { IdParamDto } from "../professionals/dto/id.param";
import { AdminSupportReplyDto } from "./dto/admin-support-reply.dto";
import { AdminSupportUpdateDto } from "./dto/admin-support-update.dto";

@Controller("admin/support")
@RequireAudience("staff")
@StaffRoles("SUPPORT")
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get("tickets")
  list() {
    return this.support.listAllTickets();
  }

  @Get("tickets/:id")
  get(@Param() params: IdParamDto) {
    return this.support.getTicketById(params.id);
  }

  @Post("tickets/:id/replies")
  reply(@CurrentUser() user: RequestUser, @Param() params: IdParamDto, @Body() body: AdminSupportReplyDto) {
    return this.support.staffReply(params.id, user.id, body.message);
  }

  @Patch("tickets/:id")
  update(@Param() params: IdParamDto, @Body() body: AdminSupportUpdateDto) {
    return this.support.staffUpdate(params.id, body);
  }
}
