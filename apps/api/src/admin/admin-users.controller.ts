import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import type { RequestUser } from "../auth/auth.types";
import { AdminUsersService } from "./admin-users.service";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto";
import { UpdateStaffRoleDto } from "./dto/update-staff-role.dto";

@Controller("admin/users")
@RequireAudience("staff")
@StaffRoles("ADMIN")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list() {
    return this.users.listTeam();
  }

  @Post()
  @StaffRoles("OWNER")
  invite(@CurrentUser() actor: RequestUser, @Body() body: CreateStaffUserDto) {
    return this.users.inviteStaff(actor, body);
  }

  @Patch(":id/staff-role")
  @StaffRoles("OWNER")
  updateRole(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() body: UpdateStaffRoleDto,
  ) {
    return this.users.updateStaffRole(actor, id, body.staffRole);
  }

  @Post(":id/deactivate")
  @StaffRoles("OWNER")
  deactivate(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.users.deactivate(actor, id);
  }

  @Post(":id/reactivate")
  @StaffRoles("OWNER")
  reactivate(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.users.reactivate(actor, id);
  }

  @Post(":id/resend-invite")
  @StaffRoles("OWNER")
  resendInvite(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.users.resendInvite(actor, id);
  }
}
