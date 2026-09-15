import {
  DigestCadence,
  ErrorCode,
  type MediaType,
  type NotificationDto,
  type NotificationFeedDto,
  NotificationType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { type Notification, Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { EventsGateway } from "../events/events.gateway";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type NewEpisodeNotification,
  selectNewEpisodeNotifications,
} from "./notification.util";

/** How far back a scan looks, so following an old show never floods the feed. */
const WINDOW_DAYS = 14;
/** Most recent notifications returned in the feed. */
const FEED_LIMIT = 50;
/** Kinds excluded from the bell feed: NEW_EPISODE (push/email only) and FOLLOW_REQUEST (superseded by the live, actionable `Follow` list). */
const FEED_EXCLUDED_TYPES = [
  NotificationType.NEW_EPISODE,
  NotificationType.FOLLOW_REQUEST,
];

/** Digest body: `S1E2 · Title` (title suffix only when known). */
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
    private readonly jobRuns: JobRunService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Hourly: scan every user with an episode digest enabled on some channel
   * and record any newly-aired episode as a ledger row. Delivery (push/mail)
   * is a separate concern, cadenced per user/channel — see
   * `NotificationDigestService`. Runs are idempotent (deduped by episode), so
   * overlapping or missed ticks are harmless.
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

  /**
   * The hourly sweep, driven by the episodes rather than by the users.
   *
   * It used to loop over every account with a digest enabled and run `scan`
   * for each — one joined episode query per user per hour, almost always
   * returning nothing. Episodes that aired in the last {@link WINDOW_DAYS}
   * days are a small set *globally* and don't grow with the user count, so
   * starting from them turns the whole sweep into a fixed handful of queries.
   *
   * `scan` itself stays as it is: one user asking for a refresh really does
   * want the narrow query.
   */
  private async runScanAll(): Promise<number> {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gt: since, lte: now },
        season: { number: { gt: 0 } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        airDate: true,
        season: {
          select: {
            number: true,
            mediaItemId: true,
            mediaItem: {
              select: {
                title: true,
                type: true,
                canonicalSource: true,
                externalIds: { select: { source: true, externalId: true } },
              },
            },
          },
        },
      },
    });

    if (episodes.length === 0) {
      this.logger.debug("No episode aired in the window, nothing to scan");
      return 0;
    }

    // Who tracks those media — the digest and domain gates are the same ones
    // `scan` applies per user, pushed into the query.
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        mediaItemId: {
          in: [...new Set(episodes.map((e) => e.season.mediaItemId))],
        },
        status: { not: "DROPPED" },
        user: {
          OR: [
            { notifyPush: { not: DigestCadence.DISABLED } },
            { notifyEmail: { not: DigestCadence.DISABLED } },
          ],
          enabledDomains: { has: "MEDIA" },
        },
      },
      select: { userId: true, mediaItemId: true, createdAt: true },
    });

    if (entries.length === 0) {
      this.logger.debug("No tracked entry for the aired episodes");
      return 0;
    }

    // Dedup is per (user, episode): keyed on dedupeKey alone, which is
    // episode-scoped, so this stays bounded by what was actually notified.
    const existing = await this.prisma.notification.findMany({
      where: { dedupeKey: { in: episodes.map((e) => `episode:${e.id}`) } },
      select: { userId: true, dedupeKey: true },
    });
    const alreadyNotified = new Set(
      existing.map(
        (n) => `${n.userId}|${n.dedupeKey!.slice("episode:".length)}`,
      ),
    );

    const episodesByMediaItem = new Map<string, typeof episodes>();

    for (const episode of episodes) {
      const bucket = episodesByMediaItem.get(episode.season.mediaItemId) ?? [];
      bucket.push(episode);
      episodesByMediaItem.set(episode.season.mediaItemId, bucket);
    }

    const rows: Prisma.NotificationCreateManyInput[] = [];
    const users = new Set<string>();

    for (const entry of entries) {
      const candidates = episodesByMediaItem.get(entry.mediaItemId) ?? [];
      const toCreate = selectNewEpisodeNotifications(
        candidates.map((e) => ({
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
          trackedSince: entry.createdAt,
        })),
        {
          since,
          now,
          // The util keys on bare episode ids, so it gets this user's slice.
          alreadyNotified: new Set(
            candidates
              .map((e) => e.id)
              .filter((id) => alreadyNotified.has(`${entry.userId}|${id}`)),
          ),
        },
      );

      if (toCreate.length === 0) continue;

      users.add(entry.userId);
      rows.push(...this.episodeNotificationRows(entry.userId, toCreate));
    }

    if (rows.length === 0) {
      // No new notifications is the common case; keep it at debug level so the
      // hourly run is observable when wanted without spamming prod logs.
      this.logger.debug(
        `Scanned ${episodes.length} aired episode(s), nothing new`,
      );
      return 0;
    }

    await this.prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    this.logger.log(
      `Created ${rows.length} notification(s) across ${users.size} user(s)`,
    );

    return rows.length;
  }

  /** The ledger rows one user's newly-aired episodes turn into. */
  private episodeNotificationRows(
    userId: string,
    toCreate: NewEpisodeNotification[],
  ): Prisma.NotificationCreateManyInput[] {
    return toCreate.map((n) => ({
      userId,
      type: NotificationType.NEW_EPISODE,
      title: n.mediaTitle,
      body: notificationBody(n),
      url: notificationUrl(n),
      dedupeKey: `episode:${n.episodeId}`,
      data: { airDate: n.airDate.toISOString() },
    }));
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
        notifyPush: true,
        notifyEmail: true,
        enabledDomains: true,
      },
    });

    // Nothing to deliver: episode rows only ever feed the digest, never the
    // in-app bell (see the model comment on Notification).
    if (
      !user ||
      (user.notifyPush === DigestCadence.DISABLED &&
        user.notifyEmail === DigestCadence.DISABLED)
    ) {
      return 0;
    }

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
      data: this.episodeNotificationRows(userId, toCreate),
      skipDuplicates: true,
    });

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
    const { count } = await this.prisma.notification.createMany({
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

    // A deduped no-op, or a kind the bell feed never shows (NEW_EPISODE,
    // FOLLOW_REQUEST — see FEED_EXCLUDED_TYPES) — nothing for the client to
    // usefully refetch.
    if (count > 0 && !FEED_EXCLUDED_TYPES.includes(input.type)) {
      this.events.emitToUser(input.userId, "notification");
    }
  }

  /**
   * The bell feed: every kind except NEW_EPISODE (push/email only) and
   * FOLLOW_REQUEST (superseded by the live, actionable `Follow` list). A row
   * that exists is by definition unread — reading deletes it.
   */
  async feed(userId: string): Promise<NotificationFeedDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      type: { notIn: FEED_EXCLUDED_TYPES },
    };
    // Counted separately: the list is capped at FEED_LIMIT, so `rows.length`
    // would freeze the bell badge at 50 once the user passes that many.
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: FEED_LIMIT,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { notifications: rows.map(toDto), unread };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        userId,
        type: { notIn: FEED_EXCLUDED_TYPES },
      },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotificationNotFound,
      );
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
