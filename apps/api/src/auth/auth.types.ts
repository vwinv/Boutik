import type { Audience, Category, MembershipRole, StaffRole, TenantStatus } from "@boutik/domain";

export type RequestUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  staffRole: StaffRole;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  audience: Audience;
  tenantId: string | null;
  memberships: Array<{
    tenantId: string;
    slug: string;
    name: string;
    role: MembershipRole;
    status: TenantStatus;
    category: Category;
  }>;
  customers: Array<{
    tenantId: string;
    slug: string;
    name: string;
  }>;
};
