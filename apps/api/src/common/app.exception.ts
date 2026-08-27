import type { ErrorCode } from "@loomkeep/shared";
import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Every deliberately-thrown business error should be an AppException, not a
 * bare BadRequestException/NotFoundException/etc — those carry no `code`,
 * so AllExceptionsFilter can't give the web app anything to translate and it
 * falls back to a generic per-status message (see
 * apps/web/src/lib/api/errors.ts). `params` are for interpolation only
 * (e.g. { title: "Dune" }) — never put translated prose in there.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    readonly params?: Record<string, string | number>,
    message?: string,
  ) {
    super(message ?? code, status);
  }
}
