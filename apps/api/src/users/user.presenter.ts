import type { User } from "@prisma/client";
import type { RequestUser } from "../auth/auth.types";

export function presentUser(user: RequestUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    staffRole: user.staffRole,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    audience: user.audience,
    tenantId: user.tenantId,
    memberships: user.memberships,
    customers: user.customers,
  };
}

export function presentUserRecord(
  user: Pick<User, "id" | "email" | "name" | "phone" | "staffRole" | "emailVerifiedAt" | "phoneVerifiedAt" | "createdAt">,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    staffRole: user.staffRole,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
  };
}
