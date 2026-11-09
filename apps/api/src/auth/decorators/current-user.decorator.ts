import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "../auth.types";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  return request.user as RequestUser;
});
