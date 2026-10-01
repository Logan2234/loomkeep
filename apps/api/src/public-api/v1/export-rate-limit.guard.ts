import { ErrorCode } from "@loomkeep/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ApiRateLimitService } from "../../api-keys/api-rate-limit.service";
import type { AuthenticatedRequest } from "../../auth/decorators/current-user.decorator";
import { AppException } from "../../common/app.exception";

/**
 * Once an hour per account, answered like the per-minute quota
 * (`api.rate_limited` + `Retry-After`) so a script handles both the same
 * way — Nest's throttler would count per IP and answer without a code.
 */
@Injectable()
export class ExportRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: ApiRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const user = http.getRequest<AuthenticatedRequest>().user;
    if (!user) return true;

    const result = this.rateLimit.consumeExport(user.sub);

    if (!result.allowed) {
      http.getResponse<FastifyReply>().header("Retry-After", result.resetIn);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.ApiRateLimited,
      );
    }

    return true;
  }
}
