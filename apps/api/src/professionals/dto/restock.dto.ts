import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class RestockParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  productId: string;
}

export class RestockDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  variantId?: string;
}
