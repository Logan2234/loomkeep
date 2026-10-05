import { ErrorCode } from "@loomkeep/shared";
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { RATE_LIMIT_HEADERS } from "../common/rate-limit-headers";
import { InstanceSettingsService } from "../instance-settings/instance-settings.service";
import { ApiRateLimitService } from "./api-rate-limit.service";

/**
 * In front of every public API route: refuses everything while the instance
 * has the API turned off, then spends one request of the account's budget
 * and says so in the headers.
 */
@Injectable()
export class PublicApiGuard implements CanActivate {
  constructor(
    private readonly settings: InstanceSettingsService,
    private readonly rateLimit: ApiRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.settings.get("publicApiEnabled")) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ApiDisabled);
    }

    const http = context.switchToHttp();
    const user = http.getRequest<AuthenticatedRequest>().user;
    if (!user) return true;

    const result = await this.rateLimit.consume(user.sub);
    const reply = http.getResponse<FastifyReply>();
    reply.header(RATE_LIMIT_HEADERS.limit, result.limit);
    reply.header(RATE_LIMIT_HEADERS.remaining, result.remaining);
    reply.header(RATE_LIMIT_HEADERS.reset, result.resetIn);

    if (!result.allowed) {
      reply.header(RATE_LIMIT_HEADERS.retryAfter, result.resetIn);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.ApiRateLimited,
      );
    }

    return true;
  }
}
