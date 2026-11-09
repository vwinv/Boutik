import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: "Le nom doit contenir au moins 2 caractères" })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Le téléphone doit être au format international, ex. +33612345678",
  })
  phone?: string;
}
