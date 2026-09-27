import { XpReason } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { localDay } from "../common/local-day.util";
import { PrismaService } from "../prisma/prisma.service";
import { XpService } from "./xp.service";

@Injectable()
export class SessionXpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  async awardForToday(userId: string, now = new Date()): Promise<boolean> {
    const day = await this.dayFor(userId, now);
    return this.xp.award(
      userId,
      XpReason.SESSION_DAY_LOGGED,
      this.sourceId(userId, day),
    );
  }

  async refreshAfterDelete(userId: string, createdAt: Date): Promise<void> {
    const timezone = await this.timezoneFor(userId);
    const day =
      localDay(timezone, createdAt) ?? createdAt.toISOString().slice(0, 10);
    const margin = 48 * 60 * 60 * 1000;
    const from = new Date(createdAt.getTime() - margin);
    const to = new Date(createdAt.getTime() + margin);

    const [games, books] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: {
          gameEntry: { userId },
          createdAt: { gte: from, lte: to },
          source: { not: "IMPORT" },
        },
        select: { createdAt: true },
      }),
      this.prisma.bookSession.findMany({
        where: {
          bookEntry: { userId },
          createdAt: { gte: from, lte: to },
          source: { not: "IMPORT" },
        },
        select: { createdAt: true },
      }),
    ]);

    const remains = [...games, ...books].some(
      (session) => localDay(timezone, session.createdAt) === day,
    );

    if (!remains) {
      await this.xp.revokeBySource("SESSION_DAY", [this.sourceId(userId, day)]);
    }
  }

  private async dayFor(userId: string, date: Date): Promise<string> {
    const timezone = await this.timezoneFor(userId);
    return localDay(timezone, date) ?? date.toISOString().slice(0, 10);
  }

  private async timezoneFor(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? "UTC";
  }

  private sourceId(userId: string, day: string): string {
    return `${userId}:${day}`;
  }
}
