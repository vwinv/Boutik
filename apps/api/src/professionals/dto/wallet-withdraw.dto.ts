import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class WalletWithdrawDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(50_000_000)
  amountXof: number;

  @IsString()
  @MinLength(8)
  @MaxLength(40)
  destination: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  destinationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;
}
