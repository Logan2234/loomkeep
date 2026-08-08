import { Controller, Get, UseGuards } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { PublicStatsGuard } from "./public-stats.guard";

/**
 * Minimal, cheap endpoint for the Homepage dashboard widget (polled every
 * ~10s) — deliberately not reusing AdminStatsController's getStats() (full
 * cohorts/retention computation) just to surface one count.
 */
@Public()
@UseGuards(PublicStatsGuard)
@Controller("public-stats")
export class PublicStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("summary")
  async getSummary(): Promise<{
    status: "ok";
    userCount: number;
    gitSha: string;
  }> {
    return {
      // Reaching this line means the query below already resolved — no
      // separate check needed. All string, unlike @nestjs/terminus's
      // /health shape (an `error` object, `{}` when healthy): Homepage's
      // customapi widget rendered that object and crashed outright (React
      // error #31, "Objects are not valid as a React child") even after
      // mapping+remapping it — found live, twice. Every field here is a
      // plain string/number on purpose.
      status: "ok",
      userCount: await this.prisma.user.count(),
      // Set at build time (see apps/api/Dockerfile) — "unknown" outside a
      // deploy.yml-built image (local dev, docker:dev/full, etc).
      gitSha: (process.env.GIT_SHA ?? "unknown").slice(0, 7),
    };
  }
}
