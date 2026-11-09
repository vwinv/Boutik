import { IsIn } from "class-validator";
import { DOCUMENT_KINDS, type DocumentKind } from "@boutik/domain";

export class UploadDocumentDto {
  @IsIn(DOCUMENT_KINDS, { message: "Type de document invalide" })
  kind: DocumentKind;
}
