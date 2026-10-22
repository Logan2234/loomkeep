import {
  AlertGroup,
  DORMANT_AFTER_DAYS,
  GHOST_AFTER_DAYS,
  isAlertEnabled,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import { localDay, localParts } from "../common/local-day.util";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService, type PausedReminderItem } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { notSuspended } from "../users/suspension.util";
import { readAlertPrefs } from "./alert-prefs.util";
import { notificationCopy } from "./notification-copy";
import { PushService } from "./push.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 3;

interface PausedWork extends PausedReminderItem {
  /** How far along, 0 to 1: the works nearest their end come first. */
  progress: number;
}

/**
 * Whether it's the first Monday of the month, 9h, where the account lives:
 * a fixed date to compute rather than a "last sent" to store.
 */
export function isPausedReminderDue(timezone: string, now: Date): boolean {
  const parts = localParts(timezone, now);
  const day = localDay(timezone, now);
  if (!parts || !day) return false;
  return (
    parts.weekday === "Mon" && parts.hour === 9 && Number(day.slice(8)) <= 7
  );
}

/**
 * The opt-in monthly `PAUSED_REMINDER`: series, books and games left alone
 * for DORMANT_AFTER_DAYS to GHOST_AFTER_DAYS, nearest their end first. A
 * ghost is left out: past six months, a nudge reads as a reproach.
 */
@Injectable()
export class PausedReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly jobRuns: JobRunService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: JOB_KEYS.PAUSED_REMINDER })
  async runReminders(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.PAUSED_REMINDER,
      () => this.run(new Date()),
      (sent) => (sent === 0 ? "Nothing to send" : `${sent} reminder(s) sent`),
    );
  }

  async run(now: Date): Promise<number> {
    const optedIn = await this.prisma.user.findMany({
      where: {
        OR: [
          { alertPrefs: { path: ["PAUSED_REMINDER", "email"], equals: true } },
          { alertPrefs: { path: ["PAUSED_REMINDER", "push"], equals: true } },
        ],
        ...notSuspended(now),
      },
      select: {
        id: true,
        email: true,
        locale: true,
        timezone: true,
        alertPrefs: true,
      },
    });

    let sent = 0;

    for (const user of optedIn) {
      if (!isPausedReminderDue(user.timezone, now)) continue;

      const works = await this.pausedWorks(user.id, now);
      if (works.length === 0) continue;

      const prefs = readAlertPrefs(user.alertPrefs);
      const items = works.slice(0, MAX_ITEMS);

      if (isAlertEnabled(prefs, "PAUSED_REMINDER", "email")) {
        await this.mail.sendPausedReminder(
          { email: user.email, locale: user.locale },
          items,
        );
      }

      if (isAlertEnabled(prefs, "PAUSED_REMINDER", "push")) {
        await this.push.sendToUser(user.id, {
          title: "Loomkeep",
          body: notificationCopy(user.locale).pausedReminderPush(
            items[0].title,
            items[0].releasedSince,
            works.length - 1,
          ),
          url: items[0].url,
          group: AlertGroup.RELEASES,
        });
      }

      sent++;
    }

    return sent;
  }

  /** Every paused work, nearest its end first; only the first ones get their aired episodes counted. */
  async pausedWorks(userId: string, now: Date): Promise<PausedWork[]> {
    const pausedBefore = new Date(now.getTime() - DORMANT_AFTER_DAYS * DAY_MS);
    const ghostBefore = new Date(now.getTime() - GHOST_AFTER_DAYS * DAY_MS);
    const pausedSessions = {
      some: { occurredAt: { gte: ghostBefore, lt: pausedBefore } },
      none: { occurredAt: { gte: pausedBefore } },
    };
    const lastSession = {
      select: { occurredAt: true },
      orderBy: { occurredAt: "desc" as const },
      take: 1,
    };

    const [series, books, games] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: {
          userId,
          status: "WATCHING",
          mediaItem: { type: { in: ["SERIES", "ANIME"] } },
          lastWatchedAt: { gt: ghostBefore, lt: pausedBefore },
        },
        select: {
          mediaItemId: true,
          watchedEpisodes: true,
          lastWatchedAt: true,
          mediaItem: {
            select: {
              title: true,
              type: true,
              episodeCount: true,
              ...CANONICAL_EXTERNAL_ID_SELECT,
            },
          },
        },
      }),
      this.prisma.bookEntry.findMany({
        where: { userId, status: "READING", sessions: pausedSessions },
        select: {
          currentPage: true,
          sessions: lastSession,
          bookItem: {
            select: {
              title: true,
              pageCount: true,
              ...CANONICAL_EXTERNAL_ID_SELECT,
            },
          },
        },
      }),
      this.prisma.gameEntry.findMany({
        where: { userId, status: "PLAYING", sessions: pausedSessions },
        select: {
          playtimeMinutes: true,
          sessions: lastSession,
          gameItem: {
            select: {
              title: true,
              timeToBeatNormallyMin: true,
              ...CANONICAL_EXTERNAL_ID_SELECT,
            },
          },
        },
      }),
    ]);

    const daysSince = (date: Date) =>
      Math.floor((now.getTime() - date.getTime()) / DAY_MS);
    const ratio = (done: number, total: number | null) =>
      total ? Math.min(1, done / total) : 0;

    const works: (PausedWork & { mediaItemId?: string; since: Date })[] = [
      ...series.map((entry) => ({
        title: entry.mediaItem.title,
        url: `/app/media/${entry.mediaItem.type.toLowerCase()}/${canonicalExternalId(entry.mediaItem, entry.mediaItem.externalIds)}`,
        episodesLeft: Math.max(
          0,
          entry.mediaItem.episodeCount - entry.watchedEpisodes,
        ),
        pagesLeft: null,
        pausedDays: daysSince(entry.lastWatchedAt!),
        releasedSince: 0,
        progress: ratio(entry.watchedEpisodes, entry.mediaItem.episodeCount),
        mediaItemId: entry.mediaItemId,
        since: entry.lastWatchedAt!,
      })),
      ...books.map((entry) => ({
        title: entry.bookItem.title,
        url: `/app/books/${canonicalExternalId(entry.bookItem, entry.bookItem.externalIds)}`,
        episodesLeft: null,
        pagesLeft: entry.bookItem.pageCount
          ? Math.max(0, entry.bookItem.pageCount - entry.currentPage)
          : null,
        pausedDays: daysSince(entry.sessions[0].occurredAt),
        releasedSince: 0,
        progress: ratio(entry.currentPage, entry.bookItem.pageCount),
        since: entry.sessions[0].occurredAt,
      })),
      ...games.map((entry) => ({
        title: entry.gameItem.title,
        url: `/app/games/${canonicalExternalId(entry.gameItem, entry.gameItem.externalIds)}`,
        episodesLeft: null,
        pagesLeft: null,
        pausedDays: daysSince(entry.sessions[0].occurredAt),
        releasedSince: 0,
        progress: ratio(
          entry.playtimeMinutes,
          entry.gameItem.timeToBeatNormallyMin,
        ),
        since: entry.sessions[0].occurredAt,
      })),
    ].sort((a, b) => b.progress - a.progress || a.pausedDays - b.pausedDays);

    await Promise.all(
      works.slice(0, MAX_ITEMS).map(async (work) => {
        if (!work.mediaItemId) return;
        work.releasedSince = await this.prisma.episode.count({
          where: {
            season: { mediaItemId: work.mediaItemId, number: { gt: 0 } },
            airDate: { gt: work.since, lte: now },
          },
        });
      }),
    );

    return works;
  }
}
