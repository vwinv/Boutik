import { Injectable } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { presentUser } from "./user.presenter";
import type { RequestUser } from "../auth/auth.types";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  me(user: RequestUser) {
    return presentUser(user);
  }

  async updateProfile(user: RequestUser, input: { name?: string; phone?: string }) {
    const phoneChanged = input.phone !== undefined && input.phone !== user.phone;
    const requirePhoneVerify = user.audience !== "storefront";
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone !== undefined
          ? {
              phone: input.phone,
              phoneVerifiedAt: phoneChanged && requirePhoneVerify ? null : undefined,
            }
          : {}),
      },
    });

    const hydrated = await this.auth.hydrate(updated, user.audience, user.tenantId);
    const payload: { user: ReturnType<typeof presentUser>; debugToken?: string } = {
      user: presentUser(hydrated),
    };

    if (phoneChanged && updated.phone && requirePhoneVerify) {
      const sent = await this.auth.requestPhoneVerification(updated.id, updated.phone);
      if ("debugToken" in sent) {
        payload.debugToken = sent.debugToken as string;
      }
    }

    return payload;
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: { include: { tenant: { select: { slug: true, name: true } } } },
        customers: { include: { tenant: { select: { slug: true, name: true } } } },
      },
    });
    if (!user) {
      throw new ApiException(API_ERROR_CODES.USER_NOT_FOUND);
    }
    return user;
  }
}
