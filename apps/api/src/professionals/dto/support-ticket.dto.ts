import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

const CATEGORIES = [
  "TECHNIQUE",
  "PAIEMENT",
  "COMMANDE",
  "RETRAIT",
  "ABONNEMENT",
  "PERSONNALISATION",
] as const;

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message!: string;
}

export class ReplySupportTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
