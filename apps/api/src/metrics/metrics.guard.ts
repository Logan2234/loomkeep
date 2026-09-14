import { ErrorCode } from "@loomkeep/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { AppException } from "../common/app.exception";
import { secretsMatch } from "../common/secret-compare.util";

/**
 * Shared-secret guard for the Prometheus scrape endpoint — same shape as
 * PublicStatsGuard (no user session, bearer token compared against an env
 * var, fails closed when unset) but its own key: Homepage's dashboard widget
 * and the metrics collector are different consumers and shouldn't share a
 * credential.
 *
 * Prometheus reaches the API over the internal Docker network, so this is a
 * second lock rather than the only one — it matters for the base
 * docker-compose.yml, which publishes the API port directly (no Caddy).
 */
@Injectable()
export class MetricsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const expected = this.config.get<string>("METRICS_API_KEY");
    const provided = request.headers.authorization?.replace(/^Bearer /, "");

    if (!expected || !provided || !secretsMatch(expected, provided)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AdminUnauthorized,
      );
    }

    return true;
  }
}
