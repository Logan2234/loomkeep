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

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
      () =>
        this.memoryIndicator.checkHeap("memory_heap", MEMORY_THRESHOLD_BYTES),
      () => this.memoryIndicator.checkRSS("memory_rss", MEMORY_THRESHOLD_BYTES),
    ]);
  }
}
