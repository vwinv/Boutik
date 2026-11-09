import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from "class-validator";
import { isReservedSlug } from "@boutik/domain";

@ValidatorConstraint({ name: "isNotReservedSlug", async: false })
export class IsNotReservedSlugConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === "string" && !isReservedSlug(value);
  }

  defaultMessage() {
    return "Ce slug est réservé par la plateforme";
  }
}

export function IsNotReservedSlug(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsNotReservedSlugConstraint,
    });
  };
}
