import { IsIn, IsOptional } from "class-validator";
import { CATEGORIES, type Category } from "@boutik/domain";

export class CatalogQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES, { message: "Catégorie invalide" })
  category?: Category;
}
