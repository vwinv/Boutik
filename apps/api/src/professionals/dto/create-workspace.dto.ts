import { Transform } from "class-transformer";
import { IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { Category } from "@boutik/domain";
import { CATEGORIES } from "@boutik/domain";
import { IsNotReservedSlug } from "../../common/validators/is-not-reserved-slug";
import { CompanyFieldsDto } from "./company-fields.dto";

export class CreateWorkspaceDto extends CompanyFieldsDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString({ message: "Le slug est requis" })
  @MinLength(3)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  @IsNotReservedSlug()
  slug: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Le nom de l'espace est requis" })
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsIn(CATEGORIES, { message: "Catégorie invalide" })
  category: Category;
}
