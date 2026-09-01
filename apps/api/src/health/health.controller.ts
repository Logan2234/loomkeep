import { Controller, Get } from "@nestjs/common";
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { join } from "node:path";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

const MEMORY_THRESHOLD_BYTES = 512 * 1024 * 1024;

// Always on (not dev-gated): its purpose is the Docker/self-host healthcheck.
@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly diskIndicator: DiskHealthIndicator,
    private readonly memoryIndicator: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
      // Same directory BackupService writes daily dumps to (see its own
      // BACKUP_DIR fallback) — a full disk fails backups silently otherwise.
      () =>
        this.diskIndicator.checkStorage("disk", {
          path: process.env.BACKUP_DIR ?? join(process.cwd(), "backups"),
          thresholdPercent: 0.9,
        }),
      () =>
        this.memoryIndicator.checkHeap("memory_heap", MEMORY_THRESHOLD_BYTES),
      () => this.memoryIndicator.checkRSS("memory_rss", MEMORY_THRESHOLD_BYTES),
    ]);
  }
}
