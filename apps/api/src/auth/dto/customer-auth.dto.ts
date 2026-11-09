import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";
import { IsNotReservedSlug } from "../../common/validators/is-not-reserved-slug";

class TenantSlugDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3, { message: "Le slug doit contenir au moins 3 caractères" })
  @MaxLength(48, { message: "Le slug ne peut pas dépasser 48 caractères" })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  @IsNotReservedSlug()
  tenantSlug: string;
}

export class CustomerRegisterDto extends TenantSlugDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: "Le nom doit contenir au moins 2 caractères" })
  @MaxLength(80)
  name: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le téléphone doit être au format international, ex. +22507001122",
  })
  phone?: string;

  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  @MaxLength(72)
  password: string;
}

export class CustomerLoginDto extends TenantSlugDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
