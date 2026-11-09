import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  BILLING_INTERVALS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SUBSCRIPTION_RESTRICTIONS,
  type BillingInterval,
  type PaymentMethod,
  type PaymentStatus,
  type SubscriptionRestriction,
} from "@boutik/domain";

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

export class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class PaymentParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  paymentId: string;
}

export class ReceiptParamDto extends PaymentParamDto {
  @IsString()
  @MinLength(1)
  receiptId: string;
}

export class ChangePlanDto {
  @IsString()
  @MinLength(1)
  planId: string;

  @IsOptional()
  @IsIn(BILLING_INTERVALS)
  interval?: BillingInterval;
}

export class AssignSubscriptionDto {
  @IsString()
  @MinLength(1)
  planId: string;

  @IsIn(BILLING_INTERVALS)
  interval: BillingInterval;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[];

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays?: number;

  @IsOptional()
  @IsIn(SUBSCRIPTION_RESTRICTIONS)
  expiredRestriction?: SubscriptionRestriction;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(80)
  reference?: string;
}

export class UpdateSubscriptionPeriodDto {
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays?: number;

  @IsOptional()
  @IsIn(SUBSCRIPTION_RESTRICTIONS)
  expiredRestriction?: SubscriptionRestriction;
}

export class RenewSubscriptionDto {
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(80)
  reference?: string;
}

export class RecordPaymentDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  amountXof?: number;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(80)
  reference?: string;
}

export class UpdatePaymentStatusDto {
  @IsIn(PAYMENT_STATUSES)
  status: PaymentStatus;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(300)
  failureReason?: string;
}

export class DeclarePaymentDto {
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(80)
  reference?: string;
}
