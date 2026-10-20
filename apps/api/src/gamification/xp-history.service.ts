import {
  XpReason,
  type PagedResult,
  type XpHistoryDayDto,
  type XpHistoryItemDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { addDays } from "../common/date.util";
import { localDay, localDayOrUtc } from "../common/local-day.util";
import { toPagedResult, type ParsedPage } from "../common/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { isGamificationEnabled } from "./gamification.config";
import type { XpSubjectData } from "./xp-subject.util";

/**
 * Active days per page: a page is a run of days, never a split one. 14 so
 * the first page always spans the two weeks the web charts.
 */
export const XP_HISTORY_PAGE_DAYS = 14;

interface LedgerRow {
  reason: string;
  sourceType: string;
  amount: number;
  createdAt: Date;
  revokedAt: Date | null;
  title: string | null;
  href: string | null;
  data: Prisma.JsonValue;
}

interface HistoryEvent {
  day: string;
  item: XpHistoryItemDto;
}

/**
 * The viewer's own XP ledger, read back as a history: each entry is a gain on
 * the day it was credited and, once revoked, a matching loss on the day it was
 * taken back — so a day's lines always add up to how the total moved that day.
 * Lines stay in time order rather than grouped by reason: the web groups runs
 * of the same reason and cuts them where a level was reached.
 */
@Injectable()
export class XpHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async history(
    userId: string,
    page: ParsedPage,
  ): Promise<PagedResult<XpHistoryDayDto>> {
    if (!isGamificationEnabled(this.config)) {
      return { items: [], hasMore: false };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    // User.timezone is unvalidated (see local-day.util.ts): an invalid one
    // would make Postgres throw, so it falls back to UTC like everywhere else.
    const timezone =
      user && localDay(user.timezone, new Date()) ? user.timezone : "UTC";

    // Paged by active day rather than by entry, so a day's groups never
    // straddle two pages.
    const dayRows = await this.prisma.$queryRaw<{ day: string }[]>`
      SELECT day FROM (
        SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date::text AS day
        FROM "XpEntry" WHERE "userId" = ${userId}
        UNION
        SELECT ("revokedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date::text
        FROM "XpEntry" WHERE "userId" = ${userId} AND "revokedAt" IS NOT NULL
      ) days
      ORDER BY day DESC
      OFFSET ${page.skip} LIMIT ${page.take + 1}`;
    const { items: days, hasMore } = toPagedResult(
      dayRows.map((row) => row.day),
      page.limit,
    );
    if (days.length === 0) return { items: [], hasMore: false };

    // A day's UTC span shifts by up to 14h either way: a day of margin on
    // each side, and the exact local day filtered below.
    const from = addDays(new Date(`${days[days.length - 1]}T00:00:00Z`), -1);
    const to = addDays(new Date(`${days[0]}T00:00:00Z`), 2);
    const rows = await this.prisma.xpEntry.findMany({
      where: {
        userId,
        OR: [
          { createdAt: { gte: from, lt: to } },
          { revokedAt: { gte: from, lt: to } },
        ],
      },
      select: {
        reason: true,
        sourceType: true,
        amount: true,
        createdAt: true,
        revokedAt: true,
        title: true,
        href: true,
        data: true,
      },
    });

    const events = toEvents(rows, timezone, new Set(days));
    return {
      items: days.map((day) =>
        toDay(
          day,
          events.filter((event) => event.day === day),
        ),
      ),
      hasMore,
    };
  }
}

function toEvents(
  rows: LedgerRow[],
  timezone: string,
  days: Set<string>,
): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const row of rows) {
    const gainDay = localDayOrUtc(timezone, row.createdAt);

    if (days.has(gainDay)) {
      events.push({
        day: gainDay,
        item: toItem(row, {
          revoked: false,
          amount: row.amount,
          at: row.createdAt,
          revokedAt: row.revokedAt,
          earnedAt: null,
        }),
      });
    }

    if (!row.revokedAt) continue;
    const lossDay = localDayOrUtc(timezone, row.revokedAt);

    if (days.has(lossDay)) {
      events.push({
        day: lossDay,
        item: toItem(row, {
          revoked: true,
          amount: -row.amount,
          at: row.revokedAt,
          revokedAt: null,
          earnedAt: row.createdAt,
        }),
      });
    }
  }

  return events;
}

function toItem(
  row: LedgerRow,
  event: {
    revoked: boolean;
    amount: number;
    at: Date;
    revokedAt: Date | null;
    earnedAt: Date | null;
  },
): XpHistoryItemDto {
  const data = (row.data ?? {}) as XpSubjectData;
  // A revoked LIST_CREATED means the list itself was deleted: its link leads
  // nowhere. Other subjects are the work, which outlives the entry or review.
  const deadLink = row.revokedAt !== null && row.sourceType === "List";
  return {
    reason: row.reason as XpReason,
    revoked: event.revoked,
    amount: event.amount,
    at: event.at.toISOString(),
    revokedAt: event.revokedAt?.toISOString() ?? null,
    earnedAt: event.earnedAt?.toISOString() ?? null,
    title: row.title,
    href: deadLink ? null : (row.href ?? pageHref(row.reason, data)),
    seasonNumber: data.seasonNumber ?? null,
    episodeNumber: data.episodeNumber ?? null,
    achievementKey: data.achievementKey ?? null,
    domain: data.domain ?? null,
    goalTarget: data.goalTarget ?? null,
    goalYear: data.goalYear ?? null,
  };
}

/**
 * The page behind a line with no work to open — built when read rather than
 * snapshotted, as these pages outlive what earned the line.
 */
function pageHref(reason: string, data: XpSubjectData): string | null {
  if (reason === XpReason.ACHIEVEMENT_UNLOCKED && data.achievementKey) {
    // Same target as the unlock bubble: the achievements page flashes the card.
    return `/app/achievements?unlocked=${encodeURIComponent(data.achievementKey)}`;
  }

  if (reason === XpReason.IMPORT_COMPLETED) {
    return "/app/settings/import/history";
  }

  return null;
}

function toDay(day: string, events: HistoryEvent[]): XpHistoryDayDto {
  const items = events
    .map((event) => event.item)
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    day,
    net: items.reduce((sum, item) => sum + item.amount, 0),
    items,
  };
}
