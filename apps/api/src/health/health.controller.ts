import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

const MEMORY_THRESHOLD_BYTES = 512 * 1024 * 1024;

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly memoryIndicator: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The three indicators still decide whether the instance is healthy — the
   * HTTP status is what Docker and Caddy read — but only the verdict goes out.
   * Terminus's own body carries live heap/RSS byte counts, and this route is
   * `@Public()`: that told anyone asking how much headroom the box has left.
   *
   * The failure path needs no equivalent treatment: Terminus throws a 503,
   * which `AllExceptionsFilter` already reduces to a generic 5xx body.
   */
  @Get()
  @HealthCheck()
  async check(): Promise<{ status: string }> {
    const result = await this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
      () =>
        this.memoryIndicator.checkHeap("memory_heap", MEMORY_THRESHOLD_BYTES),
      () => this.memoryIndicator.checkRSS("memory_rss", MEMORY_THRESHOLD_BYTES),
    ]);
    return { status: result.status };
  }
}
