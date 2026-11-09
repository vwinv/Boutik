import { IsIn } from "class-validator";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export class AdminSupportStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
