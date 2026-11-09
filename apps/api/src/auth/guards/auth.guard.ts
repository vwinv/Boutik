import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { API_ERROR_CODES, type Audience } from "@boutik/domain";
import { ApiException } from "../../common/api-exception";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../auth.types";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

type JwtPayload = {
  sub: string;
  aud: Audience;
  tenantId?: string | null;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: RequestUser }>();
    const token = bearerToken(request.headers.authorization);

    if (!token) {
      throw new ApiException(API_ERROR_CODES.UNAUTHORIZED);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new ApiException(API_ERROR_CODES.UNAUTHORIZED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: { include: { tenant: { select: { id: true, slug: true, name: true, status: true, category: true } } } },
        customers: { include: { tenant: { select: { id: true, slug: true, name: true } } } },
      },
    });

    if (!user) {
      throw new ApiException(API_ERROR_CODES.UNAUTHORIZED);
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      staffRole: user.staffRole,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      audience: payload.aud,
      tenantId: payload.tenantId ?? null,
      memberships: user.memberships.map((item) => ({
        tenantId: item.tenant.id,
        slug: item.tenant.slug,
        name: item.tenant.name,
        role: item.role,
        status: item.tenant.status,
        category: item.tenant.category,
      })),
      customers: user.customers.map((item) => ({
        tenantId: item.tenant.id,
        slug: item.tenant.slug,
        name: item.tenant.name,
      })),
    };

    return true;
  }
}

function bearerToken(header?: string) {
  if (!header) {
    return null;
  }

  const [type, token] = header.split(" ");
  return type === "Bearer" && token ? token : null;
}
