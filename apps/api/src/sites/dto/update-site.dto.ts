import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  PUBLIC_SLUG_PATTERN,
  SITE_SECTION_TYPES,
  SITE_VISUAL_KINDS,
  TIME_OF_DAY,
  WEEKDAYS,
  type SiteSectionType,
  type SiteVisualKind,
  type Weekday,
} from "@boutik/domain";
import { IsNotReservedSlug } from "../../common/validators/is-not-reserved-slug";
import { emptyToNull, emptyToUndefined, trim } from "./transforms";

const PHONE = /^\+[1-9]\d{7,14}$/;

export class UpdateSiteGeneralDto {
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

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(160)
  tagline?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  about?: string | null;
}

export class CreateSiteDto extends UpdateSiteGeneralDto {}

const SITE_LAYOUT_KEYS = ["eclat", "minimal", "atelier", "nocturne"] as const;

export class UpdateSiteThemeDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsIn(SITE_LAYOUT_KEYS, { message: "Modèle invalide" })
  layoutKey?: (typeof SITE_LAYOUT_KEYS)[number];

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsHexColor()
  textColor?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  logoUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  coverUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  bannerUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  faviconUrl?: string | null;
}

export class UpdateSiteContactDto {
  @IsOptional()
  @Transform(({ value }) => {
    const next = emptyToNull(value);
    return typeof next === "string" ? next.toLowerCase() : next;
  })
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(PHONE, { message: "Le téléphone doit être au format international, ex. +221771234567" })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(PHONE, { message: "Le WhatsApp doit être au format international, ex. +221771234567" })
  whatsapp?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  addressLine?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  facebookUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  instagramUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  tiktokUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  youtubeUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  linkedinUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  xUrl?: string | null;
}

export class UpdateSiteSocialDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  facebookUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  instagramUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  tiktokUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  youtubeUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  linkedinUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  xUrl?: string | null;
}

export class OpeningHourDayDto {
  @IsInt()
  @IsIn(WEEKDAYS)
  weekday: Weekday;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_OF_DAY, { message: "L'heure d'ouverture doit être au format HH:mm" })
  opensAt?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_OF_DAY, { message: "L'heure de fermeture doit être au format HH:mm" })
  closesAt?: string | null;
}

export class UpdateSiteHoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDayDto)
  days: OpeningHourDayDto[];
}

export class UploadSiteVisualDto {
  @IsIn(SITE_VISUAL_KINDS, { message: "Type de visuel invalide" })
  kind: SiteVisualKind;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  alt?: string | null;
}

export class UpdateSiteSeoDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  seoTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  seoDescription?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  seoKeywords?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  ogImageUrl?: string | null;
}

export class UpdateSiteDraftDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteGeneralDto)
  general?: UpdateSiteGeneralDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteThemeDto)
  theme?: UpdateSiteThemeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteContactDto)
  contact?: UpdateSiteContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteSeoDto)
  seo?: UpdateSiteSeoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteSocialDto)
  social?: UpdateSiteSocialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteHoursDto)
  hours?: UpdateSiteHoursDto;
}

export class SuspendSiteDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpsertPageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Le slug de page ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isHome?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  seoTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  seoDescription?: string | null;
}

export class CreatePageDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Le slug de page ne peut contenir que des lettres minuscules, des chiffres et des tirets",
  })
  slug: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsBoolean()
  isHome?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  seoTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  seoDescription?: string | null;
}

export class UpsertSectionDto {
  @IsOptional()
  @IsIn(SITE_SECTION_TYPES, { message: "Type de section invalide" })
  type?: SiteSectionType;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  body?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  imageUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class CreateSectionDto {
  @IsIn(SITE_SECTION_TYPES, { message: "Type de section invalide" })
  type: SiteSectionType;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  body?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_protocol: true })
  imageUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
