import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import type { RequestUser } from "../auth/auth.types";
import { AdminWalletsService } from "./admin-wallets.service";
import { AdjustWalletDto, WalletTenantParamDto } from "./dto/admin-wallet.dto";

@Controller("admin/wallets")
@RequireAudience("staff")
@StaffRoles("FINANCE")
export class AdminWalletsController {
  constructor(private readonly wallets: AdminWalletsService) {}

  @Get()
  overview() {
    return this.wallets.overview();
  }

  @Post(":id/adjust")
  @StaffRoles("ADMIN")
  adjust(
    @CurrentUser() user: RequestUser,
    @Param() params: WalletTenantParamDto,
    @Body() body: AdjustWalletDto,
  ) {
    return this.wallets.adjust(params.id, body, user.id);
  }

  @Post(":id/freeze")
  @StaffRoles("ADMIN")
  freeze(@Param() params: WalletTenantParamDto) {
    return this.wallets.freeze(params.id);
  }

  @Post(":id/unfreeze")
  @StaffRoles("ADMIN")
  unfreeze(@Param() params: WalletTenantParamDto) {
    return this.wallets.unfreeze(params.id);
  }
}
