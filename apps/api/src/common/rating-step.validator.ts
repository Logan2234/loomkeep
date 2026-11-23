import { RATING_STEP } from "@loomkeep/shared";
import { registerDecorator, ValidationOptions } from "class-validator";

// class-validator's @IsDivisibleBy truncates its divisor to an integer, so
// it can't express 0.5.
/** A rating on the half-point grid (7, 7.5 — not 7.3). */
export function IsRatingStep(options?: ValidationOptions) {
  return function (target: object, propertyName: string): void {
    registerDecorator({
      name: "isRatingStep",
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === "number" && Number.isInteger(value / RATING_STEP)
          );
        },
        defaultMessage(): string {
          return `rating must be a multiple of ${RATING_STEP}`;
        },
      },
    });
  };
}
