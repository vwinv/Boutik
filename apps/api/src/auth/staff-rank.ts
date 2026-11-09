import type { StaffRole } from "@boutik/domain";

const RANK: Record<StaffRole, number> = {
  NONE: 0,
  SUPPORT: 1,
  FINANCE: 1,
  MODERATION: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasStaffRole(userRole: StaffRole, allowed: StaffRole[]) {
  return allowed.some((role) => RANK[userRole] >= RANK[role]);
}
