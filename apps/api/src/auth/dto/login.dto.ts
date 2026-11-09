import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsString({ message: "Le mot de passe est requis" })
  @MinLength(1, { message: "Le mot de passe est requis" })
  password: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tenantSlug?: string;
}
