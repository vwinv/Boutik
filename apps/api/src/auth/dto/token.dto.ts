import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";

function blankToUndefined({ value }: { value: unknown }) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export class RefreshDto {
  @IsString({ message: "Le refresh token est requis" })
  @MinLength(20)
  refreshToken: string;
}

export class LogoutDto {
  @IsString({ message: "Le refresh token est requis" })
  @MinLength(20)
  refreshToken: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  @MaxLength(72)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  token: string;
}

export class VerifyPhoneDto {
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code: string;
}

export class VerifyPhoneCodeDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @Transform(({ value }) => (typeof value === "string" ? value.replace(/\D/g, "") : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: "Le code doit contenir 6 chiffres" })
  code: string;
}

export class OnboardingActivityDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsIn(["VITRINE", "RESTAURANT", "BOUTIQUE"], { message: "Choisissez une activité" })
  category: "VITRINE" | "RESTAURANT" | "BOUTIQUE";
}

export class OnboardingBusinessDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: "Indiquez le nom de l'entreprise" })
  @MaxLength(120)
  businessName: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[+\d][\d\s().-]{7,24}$/, { message: "Indiquez un numéro de téléphone" })
  phone: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  managerLastName?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  managerFirstName?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  @MaxLength(160)
  professionalEmail?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  address?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hours?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  instagramUrl?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  tiktokUrl?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  facebookUrl?: string;
}

export class OnboardingContractDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;
}

export class OnboardingTemplateDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsIn(["eclat", "minimal", "atelier", "nocturne"], { message: "Choisissez un modèle" })
  templateId: "eclat" | "minimal" | "atelier" | "nocturne";

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/, { message: "Couleur principale invalide" })
  primary: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/, { message: "Couleur secondaire invalide" })
  secondary: string;
}

export class OnboardingContentItemDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: "Indiquez un nom" })
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsInt({ message: "Indiquez un prix valide" })
  @Min(0)
  @Max(100_000_000)
  priceXof: number;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1_200_000, { message: "La photo est trop volumineuse" })
  image?: string;
}

export class OnboardingContentDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Ajoutez au moins un élément" })
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => OnboardingContentItemDto)
  items: OnboardingContentItemDto[];
}

export class OnboardingPreviewDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;
}

export class OnboardingPublishDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;
}

export class ResendVerificationDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  email: string;
}
