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
  async getSummary(): Promise<{ userCount: number }> {
    return { userCount: await this.prisma.user.count() };
  }
}
