import { IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AdjustWalletDto {
  /** Positif = crédit, négatif = débit. */
  @IsInt()
  amountXof: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class WalletTenantParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}
