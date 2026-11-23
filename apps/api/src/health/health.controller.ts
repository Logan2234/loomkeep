import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Readiness: the API answers and reaches its database. This is what the
   * `api` service's Compose healthcheck reads (docker/docker-compose.yml)
   * and what the deploy workflow waits on. Memory isn't part of it: a busy
   * import pushing the process over a threshold used to answer 503 here,
   * mark the container unhealthy and roll a deploy back while the API served
   * requests fine. Caddy doesn't probe it: with one upstream, taking it out
   * of rotation would only turn a slow API into a 503.
   *
   * Only the verdict goes out, never Terminus's detail: this route is
   * `@Public()`. The failure path needs no equivalent treatment: Terminus
   * throws a 503, which `AllExceptionsFilter` reduces to a generic 5xx body.
   */
  @Get()
  @HealthCheck()
  async check(): Promise<{ status: string }> {
    const result = await this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
    ]);
    return { status: result.status };
  }

  /**
   * Liveness: the process answers HTTP, nothing else checked. For an uptime
   * monitor that should tell "the API is down" apart from "its database is".
   */
  @Get("live")
  live(): { status: string } {
    return { status: "ok" };
  }
}
