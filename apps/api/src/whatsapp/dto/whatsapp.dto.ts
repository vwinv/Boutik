import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

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
