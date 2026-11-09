import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { IsNotReservedSlug } from "../../common/validators/is-not-reserved-slug";

export class TenantSlugParamDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString({ message: "Le slug doit être une chaîne" })
  @IsNotEmpty({ message: "Le slug est requis" })
  @MinLength(3, { message: "Le slug doit contenir au moins 3 caractères" })
  @MaxLength(48, { message: "Le slug ne peut pas dépasser 48 caractères" })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  @IsNotReservedSlug()
  slug: string;
}
