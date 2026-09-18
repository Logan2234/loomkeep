import type { AdminOverviewDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { trendBucketStarts } from "./admin-stats.util";

/**
 * The handful of counters the admin *dashboard* status strip and the
 * /admin/communications header need, not a statistics payload. Analytical
 * data lives on /admin/stats.
 */
@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(now = new Date()): Promise<AdminOverviewDto> {
    // Same weekly boundary as the /admin/stats curves, so "+N cette semaine"
    // means the same thing on both pages.
    const starts = trendBucketStarts("week", now);
    const weekStart = starts[starts.length - 1];

    const [
      accounts,
      newAccountsThisWeek,
      accountsWithPush,
      pushDevices,
      media,
      games,
      books,
      music,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
      this.prisma.pushSubscription.count(),
      this.prisma.mediaItem.count(),
      this.prisma.gameItem.count(),
      this.prisma.bookItem.count(),
      this.prisma.musicItem.count(),
    ]);

    return {
      accounts,
      newAccountsThisWeek,
      accountsWithPush,
      pushDevices,
      cachedItems: media + games + books + music,
    };
  }
}
