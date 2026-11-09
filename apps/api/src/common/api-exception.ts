import { HttpException } from "@nestjs/common";
import { API_ERROR_MESSAGE, API_ERROR_STATUS, type ApiErrorCode } from "@boutik/domain";

export class ApiException extends HttpException {
  readonly apiCode: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message?: string, details?: unknown) {
    super(message ?? API_ERROR_MESSAGE[code], API_ERROR_STATUS[code]);
    this.apiCode = code;
    this.details = details;
  }
}
