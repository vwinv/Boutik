import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import type { StaffRole } from "@boutik/domain";

export class CreateStaffUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(["SUPPORT", "FINANCE", "MODERATION", "OWNER"], { message: "Rôle invalide" })
  staffRole!: Exclude<StaffRole, "NONE" | "ADMIN">;
}
