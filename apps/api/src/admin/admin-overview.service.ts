import type { AdminOverviewDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { EventsGateway } from "../events/events.gateway";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_ACCOUNTS_WINDOW_DAYS = 7;

/**
 * The handful of counters the admin *dashboard* status strip and the
 * /admin/communications header need, not a statistics payload. Analytical
 * data lives on /admin/stats.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async getOverview(now = new Date()): Promise<AdminOverviewDto> {
    // A rolling window: the weekly bucket of the /admin/stats curves starts at
    // today's midnight, which would only count today's signups.
    const since = new Date(now.getTime() - NEW_ACCOUNTS_WINDOW_DAYS * DAY_MS);

    const [
      accounts,
      newAccountsLast7Days,
      connectedNow,
      accountsWithPush,
      pushDevices,
      media,
      games,
      books,
      music,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.events.connectedUserCount(),
      this.prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
      this.prisma.pushSubscription.count(),
      this.prisma.mediaItem.count(),
      this.prisma.gameItem.count(),
      this.prisma.bookItem.count(),
      this.prisma.musicItem.count(),
    ]);

    return {
      accounts,
      newAccountsLast7Days,
      connectedNow,
      accountsWithPush,
      pushDevices,
      cachedItems: media + games + books + music,
    };
  }
}
