import type { PublicStatsSummaryDto } from "@loomkeep/shared";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";
import { PublicStatsSummaryResponseDto } from "./dto/public-stats-summary-response.dto";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
  ) {}

  @Get("summary")
  @ApiOkResponse({ type: PublicStatsSummaryResponseDto })
  async getSummary(): Promise<PublicStatsSummaryDto> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Four independent counts, all cheap (indexed or table-scan-on-small-
    // table) — deliberately not AdminStatsController's getStats(), which
    // computes cohorts/retention too heavy for a ~10s widget poll.
    // getServicesStatus() is the odd one out: it live-probes every external
    // provider (TMDB, AniList, IGDB...) with no caching, so this endpoint
    // now costs one such probe round on every ~10s Homepage poll too.
    const [userCount, openReports, newUsers7d, { services }] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.report.count({ where: { status: "PENDING" } }),
        this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        this.admin.getServicesStatus(),
      ]);

    // Same "healthy/live" definition as apps/web's /admin/services page:
    // planned (comingSoon) providers excluded, healthy = configured and
    // either probed-OK or unprobeable (reachable stays null for those).
    const live = services.filter((s) => !s.comingSoon);
    const healthy = live.filter((s) => s.configured && s.reachable !== false);

    return {
      // Reaching this line means every query above already resolved — no
      // separate check needed. All string/number, unlike @nestjs/terminus's
      // /health shape (an `error` object, `{}` when healthy): Homepage's
      // customapi widget rendered that object and crashed outright (React
      // error #31, "Objects are not valid as a React child") even after
      // mapping+remapping it — found live, twice.
      status: "ok",
      userCount,
      openReports,
      newUsers7d,
      operational: `${healthy.length}/${live.length}`,
      // Set at build time (see apps/api/Dockerfile) — "unknown" outside a
      // CI-built image (pnpm dev, or any docker compose run against a
      // locally-tagged image rather than one pulled from GHCR).
      gitSha: (process.env.GIT_SHA ?? "unknown").slice(0, 7),
    };
  }
}
