import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpsertWhatsappConfigDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  phoneNumberId!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le numéro affiché doit être au format international, ex. +221771234567",
  })
  displayPhone?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  accessToken!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  businessAccountId?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateWhatsappShopDto {
  @IsOptional()
  @IsBoolean()
  shopOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @MaxLength(700)
  welcomeMessage?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @MaxLength(500)
  closedMessage?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Horaires au format HH:MM" })
  openTime?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Horaires au format HH:MM" })
  closeTime?: string | null;
}

export class EmbeddedSignupDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  code!: string;

  /** Peut être omis : on le découvre via le WABA si besoin. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  phoneNumberId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @MaxLength(64)
  wabaId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== "")
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le numéro affiché doit être au format international, ex. +221771234567",
  })
  displayPhone?: string;
}
