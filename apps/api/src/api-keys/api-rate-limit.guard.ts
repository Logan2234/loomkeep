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
import { ApiRateLimitService } from "./api-rate-limit.service";

/** Spends one request of the account's public API budget, and says so in the headers. */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: ApiRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const user = http.getRequest<AuthenticatedRequest>().user;
    if (!user) return true;

    const result = await this.rateLimit.consume(user.sub);
    const reply = http.getResponse<FastifyReply>();
    reply.header("X-RateLimit-Limit", result.limit);
    reply.header("X-RateLimit-Remaining", result.remaining);
    reply.header("X-RateLimit-Reset", result.resetIn);

    if (!result.allowed) {
      reply.header("Retry-After", result.resetIn);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.ApiRateLimited,
      );
    }

    return true;
  }
}
