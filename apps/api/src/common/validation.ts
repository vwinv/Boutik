import { ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "./api-exception";

export type FieldError = {
  field: string;
  messages: string[];
};

export function flattenValidationErrors(errors: ValidationError[], parent = ""): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    const nested = error.children?.length ? flattenValidationErrors(error.children, field) : [];
    return [...current, ...nested];
  });
}

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) =>
      new ApiException(API_ERROR_CODES.VALIDATION_ERROR, undefined, flattenValidationErrors(errors)),
  });
}
