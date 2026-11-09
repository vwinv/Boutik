import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Le nom est requis" })
  @MinLength(2, { message: "Le nom doit contenir au moins 2 caractères" })
  @MaxLength(80, { message: "Le nom ne peut pas dépasser 80 caractères" })
  name: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsString({ message: "Le mot de passe est requis" })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  @MaxLength(72, { message: "Le mot de passe ne peut pas dépasser 72 caractères" })
  password: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.replace(/[^\d+]/g, "") : value))
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le téléphone doit être au format international, ex. +2250712345678",
  })
  phone?: string;
}
