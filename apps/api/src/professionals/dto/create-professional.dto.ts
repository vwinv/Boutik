import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateProfessionalDto {
  @Transform(({ value }) => trim(value))
  @IsString({ message: "Le nom d'affichage est requis" })
  @MinLength(2, { message: "Le nom d'affichage doit contenir au moins 2 caractères" })
  @MaxLength(80)
  displayName: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le téléphone doit être au format international, ex. +221771234567",
  })
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
