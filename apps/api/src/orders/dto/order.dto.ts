import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
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
import {
  FULFILLMENT_METHODS,
  ORDER_STATUSES,
  PUBLIC_SLUG_PATTERN,
  type FulfillmentMethod,
  type OrderStatus,
} from "@boutik/domain";

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
  const next = value.trim();
  return next.length === 0 ? null : next;
}

const PHONE = /^\+[1-9]\d{7,14}$/;

export class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class OrderParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  orderId: string;
}

export class StorefrontOrderQueryDto {
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

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsIn(FULFILLMENT_METHODS)
  fulfillment?: FulfillmentMethod;
}

export class UpdateOrderSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  deliveryFeeXof?: number;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === "" ? null : value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  freeDeliveryFromXof?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  minOrderXof?: number;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifySms?: boolean;
}

export class OrderItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  productId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  productSlug?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  variantId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  variantSku?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  variantName?: string | null;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class QuoteOrderDto {
  @IsIn(FULFILLMENT_METHODS)
  fulfillment: FulfillmentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class CreateOrderDto extends QuoteOrderDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  customerName: string;

  @Transform(({ value }) => trim(value))
  @Matches(PHONE, { message: "Le téléphone doit être au format international, ex. +221771234567" })
  customerPhone: string;

  @IsOptional()
  @Transform(({ value }) => {
    const next = emptyToNull(value);
    return typeof next === "string" ? next.toLowerCase() : next;
  })
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  customerEmail?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(160)
  addressLine?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  region?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(16)
  postalCode?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(["wave", "orange", "mtn", "card", "cod"])
  paymentMethod?: "wave" | "orange" | "mtn" | "card" | "cod";

  /** OTP Orange Money SoftPay (CI) — obtenu via #144*82# */
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(12)
  paymentOtp?: string | null;

  /** URL absolue de retour après paiement. */
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  returnUrl?: string | null;

  /** URL absolue si le client annule. */
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  cancelUrl?: string | null;
}

export class OrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;
}

export class CancelOrderDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(300)
  reason?: string;
}
