import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class WithdrawalIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class RejectWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
