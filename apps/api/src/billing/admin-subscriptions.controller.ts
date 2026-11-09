import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { BillingService } from "./billing.service";
import { ChangePlanDto, WorkspaceIdParamDto } from "./dto/billing.dto";

@Controller("admin/subscriptions")
@RequireAudience("staff")
@StaffRoles("FINANCE")
export class AdminSubscriptionsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  list() {
    return this.billing.listAdminSubscriptions();
  }

  @Post(":id/change-plan")
  @StaffRoles("ADMIN")
  changePlan(@Param() params: WorkspaceIdParamDto, @Body() body: ChangePlanDto) {
    return this.billing.changePlan(params.id, body);
  }

  @Post(":id/gift-month")
  @StaffRoles("ADMIN")
  giftMonth(@Param() params: WorkspaceIdParamDto) {
    return this.billing.giftMonth(params.id);
  }

  @Post(":id/cancel")
  @StaffRoles("ADMIN")
  cancel(@Param() params: WorkspaceIdParamDto) {
    return this.billing.cancelSubscription(params.id);
  }

  @Post(":id/remind")
  remind(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.billing.remindSubscription(params.id, user.id);
  }
}
