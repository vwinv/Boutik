import { IsString, MinLength } from "class-validator";

export class IdParamDto {
  @IsString()
  @MinLength(1)
  id: string;
}

export class DocumentParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  documentId: string;
}

export class NotificationParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  notificationId: string;
}

export class SupportTicketParamDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(1)
  ticketId: string;
}
