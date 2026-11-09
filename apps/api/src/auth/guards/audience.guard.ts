import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_ERROR_CODES, type Audience } from "@boutik/domain";
import { ApiException } from "../../common/api-exception";
import type { RequestUser } from "../auth.types";
import { AUDIENCE_KEY } from "../decorators/audience.decorator";

@Injectable()
export class AudienceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowed = this.reflector.getAllAndOverride<Audience[]>(AUDIENCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowed || allowed.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user || !allowed.includes(user.audience)) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN);
    }

    return true;
  }
}
