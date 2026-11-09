import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
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
import {
  BILLING_INTERVALS,
  CAPABILITIES,
  CATEGORIES,
  SUBSCRIPTION_RESTRICTIONS,
  type BillingInterval,
  type Capability,
  type Category,
  type SubscriptionRestriction,
} from "@boutik/domain";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateSiteCategoryDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CategoryCodeParamDto {
  @IsIn(CATEGORIES)
  code: Category;
}

export class CreateSubcategoryDto {
  @IsIn(CATEGORIES, { message: "Catégorie invalide" })
  category: Category;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSubcategoryDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class PlanPriceDto {
  @IsIn(BILLING_INTERVALS)
  interval: BillingInterval;

  @IsInt({ message: "Le tarif doit être un entier en XOF" })
  @Min(0)
  amountXof: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePlanOptionDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(0)
  amountXof: number;

  @IsOptional()
  @IsIn(CAPABILITIES)
  capability?: Capability;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanOptionDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountXof?: number;

  @IsOptional()
  @IsIn(CAPABILITIES)
  capability?: Capability;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePlanDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description: string;

  @IsIn(CATEGORIES)
  category: Category;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  includesPremiumTemplates?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CAPABILITIES, { each: true })
  capabilities: Capability[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays?: number;

  @IsOptional()
  @IsIn(SUBSCRIPTION_RESTRICTIONS)
  expiredRestriction?: SubscriptionRestriction;

  /** Commission % (Boutique / Restaurant). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPct?: number | null;

  /** Limite produits (Boutique) ou plats (Restaurant). Null = illimité. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCatalogItems?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxCollaborators?: number;

  /** Limite rendez-vous (Vitrine). Null = illimité. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAppointments?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices: PlanPriceDto[];
}

export class UpdatePlanDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  includesPremiumTemplates?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CAPABILITIES, { each: true })
  capabilities?: Capability[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays?: number;

  @IsOptional()
  @IsIn(SUBSCRIPTION_RESTRICTIONS)
  expiredRestriction?: SubscriptionRestriction;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPct?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCatalogItems?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxCollaborators?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAppointments?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices?: PlanPriceDto[];
}

export class CreateTemplateDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  previewUrl?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CATEGORIES, { each: true })
  categories: Category[];
}

export class UpdateTemplateDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  previewUrl?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CATEGORIES, { each: true })
  categories?: Category[];
}

export class ReplacePricesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices: PlanPriceDto[];
}

export class UpdateOfferingDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  subcategoryId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  planId?: string;

  @IsOptional()
  @IsIn(BILLING_INTERVALS)
  interval?: BillingInterval;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  templateId?: string | null;
}
