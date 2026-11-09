import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, MinLength } from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class CompanyFieldsDto {
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(20)
  ninea?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(40)
  rccm?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(16)
  postalCode?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2, { message: "Le pays doit être un code ISO à 2 lettres" })
  country?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value)?.toLowerCase())
  @IsEmail({}, { message: "Adresse e-mail de contact invalide" })
  contactEmail?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le téléphone de contact doit être au format international, ex. +221771234567",
  })
  contactPhone?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUrl({ require_protocol: true }, { message: "L'URL du site doit être valide" })
  website?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(3, 3, { message: "La devise doit être un code ISO à 3 lettres" })
  currency?: string;
}
