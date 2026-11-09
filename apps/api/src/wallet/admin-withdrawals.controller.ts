import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { AdminWithdrawalsService } from "./admin-withdrawals.service";
import { RejectWithdrawalDto, WithdrawalIdParamDto } from "./dto/admin-withdrawal.dto";

@Controller("admin/withdrawals")
@RequireAudience("staff")
@StaffRoles("FINANCE")
export class AdminWithdrawalsController {
  constructor(private readonly withdrawals: AdminWithdrawalsService) {}

  @Get()
  list() {
    return this.withdrawals.list();
  }

  @Post(":id/accept")
  @StaffRoles("ADMIN")
  accept(@Param() params: WithdrawalIdParamDto) {
    return this.withdrawals.accept(params.id);
  }

  @Post(":id/reject")
  @StaffRoles("ADMIN")
  reject(@Param() params: WithdrawalIdParamDto, @Body() body: RejectWithdrawalDto) {
    return this.withdrawals.reject(params.id, body.reason);
  }

  @Post(":id/mark-paid")
  @StaffRoles("ADMIN")
  markPaid(@Param() params: WithdrawalIdParamDto) {
    return this.withdrawals.markPaid(params.id);
  }
}
