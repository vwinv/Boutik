import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { PRODUCT_AVAILABILITIES, PUBLIC_SLUG_PATTERN, type ProductAvailability } from "@boutik/domain";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function emptyToNull(value: unknown) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class ProductParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  productId: string;
}

export class ProductCategoryParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  categoryId: string;
}

export class ProductVariantParamDto extends ProductParamDto {
  @IsString()
  @MinLength(1)
  variantId: string;
}

export class ProductPhotoParamDto extends ProductParamDto {
  @IsString()
  @MinLength(1)
  photoId: string;
}

export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}

export class CreateProductCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  slug?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  slug?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  description?: string | null;

  @IsInt()
  @Min(0)
  priceXof: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  compareAtPriceXof?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: ProductAvailability;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  stockQty?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceXof?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  compareAtPriceXof?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: ProductAvailability;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  stockQty?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class VariantOptionDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  kind: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  value: string;
}

export class CreateVariantDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  sku?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  priceXof?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: ProductAvailability;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  stockQty?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  option1Kind?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  option1Value?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  option2Kind?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  option2Value?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options?: VariantOptionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  sku?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  priceXof?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_AVAILABILITIES)
  availability?: ProductAvailability | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  stockQty?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  option1Kind?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  option1Value?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  option2Kind?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  option2Value?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options?: VariantOptionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePhotoDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  alt?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  optionKind?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  optionValue?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class StorefrontCatalogQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(3)
  @MaxLength(253)
  host?: string;
}

export class StorefrontProductParamDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN)
  productSlug: string;
}

export class StorefrontPhotoParamDto extends StorefrontProductParamDto {
  @IsString()
  @MinLength(1)
  photoId: string;
}

export class CreateProductReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorName: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  body: string;
}
