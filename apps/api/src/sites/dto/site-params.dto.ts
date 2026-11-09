import { Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";
import { PUBLIC_SLUG_PATTERN } from "@boutik/domain";
import { IsNotReservedSlug } from "../../common/validators/is-not-reserved-slug";
import { trim } from "./transforms";

export class WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class SitePageParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  pageId: string;
}

export class SiteSectionParamDto extends SitePageParamDto {
  @IsString()
  @MinLength(1)
  sectionId: string;
}

export class SiteAssetParamDto extends WorkspaceIdParamDto {
  @IsString()
  @MinLength(1)
  assetId: string;
}

export class ReorderIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}

export class SiteSlugQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN, {
    message: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  @IsNotReservedSlug()
  slug?: string;
}

export class ResolveSiteQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  @Matches(PUBLIC_SLUG_PATTERN, {
    message: "Le slug ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(3)
  @MaxLength(253)
  host?: string;

  @ValidateIf((input: ResolveSiteQueryDto) => !input.slug && !input.host)
  @IsNotEmpty({ message: "Indiquez un slug ou un sous-domaine" })
  either?: string;
}

