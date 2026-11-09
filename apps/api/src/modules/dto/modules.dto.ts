import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

enum CategoryDto {
  VITRINE = "VITRINE",
  RESTAURANT = "RESTAURANT",
  BOUTIQUE = "BOUTIQUE",
}

export class UpdatePlatformModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountXof?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(CategoryDto, { each: true })
  categories?: Array<"VITRINE" | "RESTAURANT" | "BOUTIQUE">;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SetTenantModuleDto {
  @IsBoolean()
  active!: boolean;
}
