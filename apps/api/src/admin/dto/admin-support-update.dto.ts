import { IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export class AdminSupportUpdateDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assignedToUserId?: string | null;
}
