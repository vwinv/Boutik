import { IsIn } from "class-validator";
import type { StaffRole } from "@boutik/domain";

export class UpdateStaffRoleDto {
  @IsIn(["SUPPORT", "FINANCE", "MODERATION", "ADMIN", "OWNER", "NONE"], {
    message: "Rôle invalide",
  })
  staffRole!: StaffRole;
}
