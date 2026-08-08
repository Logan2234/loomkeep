import { Controller, Get, UseGuards } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";
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
  async getSummary(): Promise<{
    status: "ok";
    userCount: number;
    mediaCount: number;
    openReports: number;
    newUsers7d: number;
    gitSha: string;
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Four independent counts, all cheap (indexed or table-scan-on-small-
    // table) — deliberately not AdminStatsController's getStats(), which
    // computes cohorts/retention too heavy for a ~10s widget poll.
    const [userCount, mediaCount, openReports, newUsers7d] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.libraryEntry.count(),
      this.prisma.report.count({ where: { status: "PENDING" } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    return {
      // Reaching this line means every query above already resolved — no
      // separate check needed. All string/number, unlike @nestjs/terminus's
      // /health shape (an `error` object, `{}` when healthy): Homepage's
      // customapi widget rendered that object and crashed outright (React
      // error #31, "Objects are not valid as a React child") even after
      // mapping+remapping it — found live, twice.
      status: "ok",
      userCount,
      mediaCount,
      openReports,
      newUsers7d,
      // Set at build time (see apps/api/Dockerfile) — "unknown" outside a
      // deploy.yml-built image (local dev, docker:dev/full, etc).
      gitSha: (process.env.GIT_SHA ?? "unknown").slice(0, 7),
    };
  }

  /**
   * Separate from summary() on purpose: AdminService.getServicesStatus()
   * live-probes every external provider (TMDB, AniList, IGDB...) with no
   * caching — fine on an admin page a human opens occasionally, too
   * expensive to run on summary()'s ~10s poll. Homepage hits this one on
   * its own longer refreshInterval instead (see services.yaml).
   */
  @Get("services-summary")
  async getServicesSummary(): Promise<{ operational: string }> {
    const { services } = await this.admin.getServicesStatus();
    // Same "healthy/live" definition as apps/web's /admin/services page:
    // planned (comingSoon) providers excluded, healthy = configured and
    // either probed-OK or unprobeable (reachable stays null for those).
    const live = services.filter((s) => !s.comingSoon);
    const healthy = live.filter((s) => s.configured && s.reachable !== false);
    return { operational: `${healthy.length}/${live.length}` };
  }
}
