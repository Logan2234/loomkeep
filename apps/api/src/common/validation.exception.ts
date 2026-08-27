import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, type ValidationError } from "@nestjs/common";
import { AppException } from "./app.exception";
import { extractConstraintParams } from "./validation-params.util";

interface ValidationDetail {
  field: string;
  constraint: string;
  params?: (string | number | boolean)[];
}

/**
 * Thrown by the global ValidationPipe's exceptionFactory (see main.ts)
 * instead of Nest's default flat message-array BadRequestException. Carries
 * per-field {field, constraint, params} triples so apps/web can render a
 * translated message under each input (see
 * apps/web/src/lib/api/validation-messages.ts) instead of the raw English
 * class-validator message.
 */
export class ValidationException extends AppException {
  readonly details: ValidationDetail[];

  constructor(errors: ValidationError[]) {
    const details = flattenValidationErrors(errors);
    super(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ValidationFailed,
      undefined,
      details.map((d) => `${d.field}: ${d.constraint}`).join(", ") ||
        "Validation failed",
    );
    this.details = details;
  }
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const own = Object.keys(error.constraints ?? {}).map((constraint) => ({
      field,
      constraint,
      params: extractConstraintParams(error.target, error.property, constraint),
    }));

    const nested = error.children?.length
      ? flattenValidationErrors(error.children, field)
      : [];
    return [...own, ...nested];
  });
}
