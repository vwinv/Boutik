import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_ERROR_CODES, type StaffRole } from "@boutik/domain";
import { ApiException } from "../../common/api-exception";
import type { RequestUser } from "../auth.types";
import { STAFF_ROLES_KEY } from "../decorators/staff-roles.decorator";
import { hasStaffRole } from "../staff-rank";

@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowed = this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowed || allowed.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user || user.audience !== "staff" || !hasStaffRole(user.staffRole, allowed)) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }

    return true;
  }
}
