import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { type Notification, Prisma } from "@prisma/client";
import {
  type MediaType,
  type NotificationDto,
  type NotificationFeedDto,
  NotificationType,
} from "@loomkeep/shared";
import { canonicalExternalId } from "../common/external-id.util";
import { MailService } from "../mail/mail.service";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type NewEpisodeNotification,
  selectNewEpisodeNotifications,
} from "./notification.util";
import { PushService } from "./push.service";

/** How far back a scan looks, so following an old show never floods the feed. */
const WINDOW_DAYS = 14;
/** Most recent notifications returned in the feed. */
const FEED_LIMIT = 50;

/** Push/email body: `S1E2 · Title` (title suffix only when known). */
function notificationBody(n: NewEpisodeNotification): string {
  return `S${n.seasonNumber}E${n.episodeNumber}${n.episodeTitle ? " · " + n.episodeTitle : ""}`;
}

/** Deep link to the media detail page for a notification. */
function notificationUrl(n: NewEpisodeNotification): string {
  return `/app/media/${n.mediaType.toLowerCase()}/${n.sourceId}`;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Hourly: scan every user with push or email episode alerts enabled, so
   * those channels fire without the client having to poll. Runs are
   * idempotent (deduped by episode), so overlapping or missed ticks are
   * harmless.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scanAll(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.NOTIFICATIONS_SCAN,
      () => this.runScanAll(),
      (created) =>
        created > 0 ? `${created} notification(s) créée(s)` : "Rien de nouveau",
    );
  }

  private async runScanAll(): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { OR: [{ notifyPush: true }, { notifyEmail: true }] },
      select: { id: true },
    });

    let created = 0;

    for (const { id } of users) {
      try {
        created += await this.scan(id);
      } catch (err) {
        // One user's failure must not abort the batch.
        this.logger.error(`Notification scan failed for user ${id}`, err);
      }
    }

    if (created > 0) {
      this.logger.log(
        `Created ${created} notification(s) across ${users.length} user(s)`,
      );
    } else {
      // No new notifications is the common case; keep it at debug level so the
      // hourly run is observable when wanted without spamming prod logs.
      this.logger.debug(`Scanned ${users.length} user(s), nothing new`);
    }

    return created;
  }

  /**
   * Detect episodes of the user's tracked (non-dropped) shows that aired in the
   * last {@link WINDOW_DAYS} days and create one notification each (idempotent).
   * Returns how many were created.
   */
  async scan(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        notifyPush: true,
        notifyEmail: true,
        enabledDomains: true,
      },
    });

    // Nothing to deliver: episode rows only ever drive push/email, never the
    // in-app bell (see the model comment on Notification).
    if (!user || (!user.notifyPush && !user.notifyEmail)) return 0;
    // Episode alerts belong to the MEDIA domain: a user who disabled it gets
    // none. Filtered here (not by hiding the feed) so other notification types
    // stay available.
    if (!user.enabledDomains.includes("MEDIA")) return 0;

    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gt: since, lte: now },
        season: {
          number: { gt: 0 },
          mediaItem: {
            entries: { some: { userId, status: { not: "DROPPED" } } },
          },
        },
      },
      include: {
        season: {
          include: {
            mediaItem: {
              include: {
                externalIds: true,
                // Unique per (userId, mediaItemId), and guaranteed to exist
                // by the `where` above — this is the user's tracked entry.
                entries: { where: { userId }, select: { createdAt: true } },
              },
            },
          },
        },
      },
    });

    if (episodes.length === 0) return 0;

    const existing = await this.prisma.notification.findMany({
      where: {
        userId,
        dedupeKey: { in: episodes.map((e) => `episode:${e.id}`) },
      },
      select: { dedupeKey: true },
    });

    const alreadyNotified = new Set(
      // Strip the "episode:" prefix back to the bare episode id the util keys on.
      existing.map((n) => n.dedupeKey!.slice("episode:".length)),
    );

    const toCreate = selectNewEpisodeNotifications(
      episodes.map((e) => ({
        episodeId: e.id,
        // Non-null: guaranteed by the `airDate` filter above.
        airDate: e.airDate!,
        seasonNumber: e.season.number,
        episodeNumber: e.number,
        episodeTitle: e.title,
        mediaTitle: e.season.mediaItem.title,
        mediaType: e.season.mediaItem.type as MediaType,
        sourceId: canonicalExternalId(
          e.season.mediaItem,
          e.season.mediaItem.externalIds,
        ),
        trackedSince: e.season.mediaItem.entries[0].createdAt,
      })),
      { since, now, alreadyNotified },
    );

    if (toCreate.length === 0) return 0;

    await this.prisma.notification.createMany({
      data: toCreate.map((n) => ({
        userId,
        type: NotificationType.NEW_EPISODE,
        title: n.mediaTitle,
        body: notificationBody(n),
        url: notificationUrl(n),
        dedupeKey: `episode:${n.episodeId}`,
        data: { airDate: n.airDate.toISOString() },
      })),
      skipDuplicates: true,
    });

    if (user.notifyPush) {
      await Promise.all(
        toCreate.map((n) =>
          this.push.sendToUser(userId, {
            title: n.mediaTitle,
            body: notificationBody(n),
            url: notificationUrl(n),
          }),
        ),
      );
    }

    if (user.notifyEmail) {
      await Promise.all(
        toCreate.map((n) =>
          this.mail.sendNewEpisode(
            user.email,
            n.mediaTitle,
            notificationBody(n),
            notificationUrl(n),
          ),
        ),
      );
    }

    return toCreate.length;
  }

  /**
   * Creates one in-app notification. Idempotent per `dedupeKey` (a re-follow or
   * a re-scan won't duplicate a row). Used by other domains (e.g. social) to
   * post notifications without knowing the storage shape.
   */
  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    url?: string | null;
    dedupeKey?: string | null;
    data?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.notification.createMany({
      data: [
        {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          url: input.url ?? null,
          dedupeKey: input.dedupeKey ?? null,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
  }

  /**
   * The bell feed: every kind except NEW_EPISODE (push/email only) and
   * FOLLOW_REQUEST (superseded by the live, actionable `Follow` list). A row
   * that exists is by definition unread — reading deletes it.
   */
  async feed(userId: string): Promise<NotificationFeedDto> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        type: {
          notIn: [
            NotificationType.NEW_EPISODE,
            NotificationType.FOLLOW_REQUEST,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    });
    return { notifications: rows.map(toDto), unread: rows.length };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        userId,
        type: {
          notIn: [
            NotificationType.NEW_EPISODE,
            NotificationType.FOLLOW_REQUEST,
          ],
        },
      },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new NotFoundException("Notification not found");
    }
  }
}

function toDto(n: Notification): NotificationDto {
  const data = (n.data ?? {}) as Record<string, unknown>;
  // NEW_EPISODE stores the real air date to show instead of the scan time.
  const airDate = typeof data.airDate === "string" ? data.airDate : null;
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    data,
    timestamp: airDate ?? n.createdAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
  };
}
