import { IsString, MinLength } from "class-validator";

export class SwitchTenantDto {
  @IsString({ message: "L'espace professionnel est requis" })
  @MinLength(1)
  tenantId: string;
}
