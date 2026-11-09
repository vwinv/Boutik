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
  PUBLIC_SLUG_PATTERN,
  RESERVATION_STATUSES,
  TIME_OF_DAY,
  WEEKDAYS,
  type ReservationStatus,
  type Weekday,
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+[1-9]\d{7,14}$/;

export class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class ReservationParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  reservationId: string;
}

export class StorefrontReservationQueryDto {
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

  @IsOptional()
  @Matches(DATE, { message: "La date doit être au format AAAA-MM-JJ" })
  date?: string;
}

export class ListReservationsQueryDto {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;
}

export class UpdateReservationSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  slotDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(120)
  slotIntervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  minPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxCoversPerSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxReservationsPerSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  minAdvanceHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  maxAdvanceDays?: number;
}

export class ReservationHourDayDto {
  @IsInt()
  @IsIn(WEEKDAYS)
  weekday: Weekday;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_OF_DAY)
  opensAt?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_OF_DAY)
  closesAt?: string | null;
}

export class UpdateReservationHoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservationHourDayDto)
  days: ReservationHourDayDto[];
}

export class CreateReservationDto {
  @Matches(DATE, { message: "La date doit être au format AAAA-MM-JJ" })
  date: string;

  @Matches(TIME_OF_DAY, { message: "L'heure doit être au format HH:mm" })
  time: string;

  @IsInt()
  @Min(1)
  @Max(50)
  partySize: number;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  guestName: string;

  @Transform(({ value }) => trim(value))
  @Matches(PHONE, { message: "Le téléphone doit être au format international, ex. +221771234567" })
  guestPhone: string;

  @IsOptional()
  @Transform(({ value }) => {
    const next = emptyToNull(value);
    return typeof next === "string" ? next.toLowerCase() : next;
  })
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  guestEmail?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdateReservationDto {
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY)
  time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  guestName?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @Matches(PHONE)
  guestPhone?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  guestEmail?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ReservationStatusDto {
  @IsIn(RESERVATION_STATUSES)
  status: ReservationStatus;
}

export class CancelReservationDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(300)
  reason?: string;
}
