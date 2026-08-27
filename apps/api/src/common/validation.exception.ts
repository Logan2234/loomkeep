import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, type ValidationError } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Thrown by the global ValidationPipe's exceptionFactory (see main.ts)
 * instead of Nest's default flat message-array BadRequestException. Carries
 * per-field {field, constraint} pairs so the web app can eventually render
 * them under each input — see the "Translate form validation errors" ticket.
 * Until that ships, apps/web falls back to the joined constraint messages
 * for this one code (see the ValidationFailed case in
 * apps/web/src/lib/api/errors.ts) rather than a generic sentence, so no
 * screen regresses.
 */
export class ValidationException extends AppException {
  readonly details: { field: string; constraint: string }[];

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
): { field: string; constraint: string }[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.keys(error.constraints ?? {}).map((constraint) => ({
      field,
      constraint,
    }));
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, field)
      : [];
    return [...own, ...nested];
  });
}
