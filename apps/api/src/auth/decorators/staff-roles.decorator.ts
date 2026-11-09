import { SetMetadata } from "@nestjs/common";
import type { StaffRole } from "@boutik/domain";

export const STAFF_ROLES_KEY = "staffRoles";

export const StaffRoles = (...roles: Exclude<StaffRole, "NONE">[]) => SetMetadata(STAFF_ROLES_KEY, roles);
