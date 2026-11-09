import { HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGE,
  type ApiErrorCode,
  errorCodeFromHttpStatus,
} from "@boutik/domain";
import { ApiException } from "./api-exception";

export type MappedException = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  exposeStack: boolean;
};

export function mapException(exception: unknown): MappedException {
  if (exception instanceof ApiException) {
    return {
      status: exception.getStatus(),
      code: exception.apiCode,
      message: exception.message,
      details: exception.details,
      exposeStack: exception.getStatus() >= 500,
    };
  }

  const prismaMapped = mapPrismaException(exception);
  if (prismaMapped) {
    return prismaMapped;
  }

  if (isMalformedJson(exception)) {
    return malformedJson();
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const validationDetails = validationDetailsFrom(payload);

    if (validationDetails) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: API_ERROR_MESSAGE.VALIDATION_ERROR,
        details: validationDetails,
        exposeStack: false,
      };
    }

    if (isJsonParseMessage(httpMessage(payload, errorCodeFromHttpStatus(status)))) {
      return malformedJson();
    }

    return {
      status,
      code: errorCodeFromHttpStatus(status),
      message: httpMessage(payload, errorCodeFromHttpStatus(status)),
      exposeStack: status >= 500,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message: API_ERROR_MESSAGE.INTERNAL_ERROR,
    exposeStack: true,
  };
}

function mapPrismaException(exception: unknown): MappedException | undefined {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === "P2002") {
      return {
        status: HttpStatus.CONFLICT,
        code: API_ERROR_CODES.CONFLICT,
        message: API_ERROR_MESSAGE.CONFLICT,
        details: { fields: exception.meta?.target },
        exposeStack: false,
      };
    }

    if (exception.code === "P2003" || exception.code === "P2014") {
      return {
        status: HttpStatus.CONFLICT,
        code: API_ERROR_CODES.CONFLICT,
        message: API_ERROR_MESSAGE.CONFLICT,
        exposeStack: false,
      };
    }

    if (exception.code === "P2025") {
      return {
        status: HttpStatus.NOT_FOUND,
        code: API_ERROR_CODES.NOT_FOUND,
        message: API_ERROR_MESSAGE.NOT_FOUND,
        exposeStack: false,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: API_ERROR_MESSAGE.INTERNAL_ERROR,
      exposeStack: true,
    };
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: API_ERROR_CODES.BAD_REQUEST,
      message: API_ERROR_MESSAGE.BAD_REQUEST,
      exposeStack: false,
    };
  }

  if (
    exception instanceof Prisma.PrismaClientInitializationError ||
    exception instanceof Prisma.PrismaClientRustPanicError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: API_ERROR_MESSAGE.INTERNAL_ERROR,
      exposeStack: true,
    };
  }

  return undefined;
}

function malformedJson(): MappedException {
  return {
    status: HttpStatus.BAD_REQUEST,
    code: API_ERROR_CODES.BAD_REQUEST,
    message: "JSON invalide",
    exposeStack: false,
  };
}

function isMalformedJson(exception: unknown) {
  if (exception instanceof SyntaxError && "body" in exception) {
    return true;
  }

  if (exception instanceof HttpException && exception.cause instanceof SyntaxError) {
    return true;
  }

  return false;
}

function isJsonParseMessage(message: string) {
  return /JSON|Unexpected token|Expected property name/i.test(message);
}

function validationDetailsFrom(payload: string | object) {
  if (typeof payload !== "object" || payload === null || !("message" in payload)) {
    return undefined;
  }

  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message;
  }

  return undefined;
}

function httpMessage(payload: string | object, code: ApiErrorCode) {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return API_ERROR_MESSAGE[code];
}
