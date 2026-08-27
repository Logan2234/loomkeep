import { ErrorCode } from "@loomkeep/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { AppException } from "../common/app.exception";

/**
 * Shared-secret guard for the public-stats endpoint the Homepage dashboard
 * widget calls — there's no user session involved (route is also
 * `@Public()`, skipping the global JwtAuthGuard), so this compares a bearer
 * token against HOMEPAGE_STATS_API_KEY instead. Fails closed if the env var
 * isn't set, same "no key configured = no access" default used by every
 * other add-on integration.
 */
@Injectable()
export class PublicStatsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const expected = process.env.HOMEPAGE_STATS_API_KEY;
    const provided = request.headers.authorization?.replace(/^Bearer /, "");

    if (!expected || !provided) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AdminUnauthorized,
      );
    }

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);

    // Lengths must match before timingSafeEqual (it throws on mismatched
    // buffer sizes rather than returning false).
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AdminUnauthorized,
      );
    }

    return true;
  }
}
