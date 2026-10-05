import {
  type AlertPrefs,
  DigestCadence,
  ErrorCode,
  gameReleaseAlertDay,
  isAlertEnabled,
  isAlertToggleable,
  type MediaType,
  movieReleaseDates,
  movieReleaseInfo,
  type NotificationDto,
  type NotificationFeedDto,
  NotificationType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { type Notification, Prisma } from "@prisma/client";
import { resolveWatchRegion } from "../catalog/watch-region.util";
import { AppException } from "../common/app.exception";
import { sinceDaysAgo, utcDateKey } from "../common/date.util";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import { EventsGateway } from "../events/events.gateway";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { isSuspended } from "../users/suspension.util";
import { type NotificationCopy, notificationCopy } from "./notification-copy";
import {
  type NewEpisodeNotification,
  selectNewEpisodeNotifications,
} from "./notification.util";
import { PushService } from "./push.service";

/** How far back a scan looks, so following an old show never floods the feed. */
const WINDOW_DAYS = 14;
/** Most recent notifications returned in the feed. */
const FEED_LIMIT = 50;
/** Kinds excluded from the bell feed: NEW_EPISODE (push/email only) and FOLLOW_REQUEST (superseded by the live, actionable `Follow` list). */
const FEED_EXCLUDED_TYPES: NotificationType[] = [
  NotificationType.NEW_EPISODE,
  NotificationType.NEW_MOVIE,
  NotificationType.NEW_GAME,
  NotificationType.FOLLOW_REQUEST,
];

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
  dedupeKey?: string | null;
  data?: Record<string, unknown>;
};

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
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /**
   * The copy bundle for whoever is about to receive a notification.
   *
   * Centralised here because a notification's text is persisted at creation
   * time, so every caller writing static prose needs the recipient's stored
   * locale — one lookup, one place, rather than five.
   */
  async copyFor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return notificationCopy(user?.locale);
  }

  /**
   * Hourly: scan every user with an episode digest enabled on some channel
   * and record any newly-aired episode as a ledger row. Delivery (push/mail)
   * is a separate concern, cadenced per user/channel — see
   * `NotificationDigestService`. Runs are idempotent (deduped by episode), so
   * overlapping or missed ticks are harmless.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: JOB_KEYS.NOTIFICATIONS_SCAN })
  async scanAll(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.NOTIFICATIONS_SCAN,
      () => this.runScanAll(),
      (created) =>
        created > 0 ? `${created} notification(s) created` : "Nothing new",
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
    const moviesCreated =
      (await this.scanMovies()) +
      (await this.scanGames()) +
      (await this.scanSagaSequels()) +
      (await this.scanGameSagaSequels());
    const now = new Date();
    const since = sinceDaysAgo(now, WINDOW_DAYS);

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
                ...CANONICAL_EXTERNAL_ID_SELECT,
              },
            },
          },
        },
      },
    });

    if (episodes.length === 0) {
      this.logger.debug("No episode aired in the window, nothing to scan");
      return moviesCreated;
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
      return moviesCreated;
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
      return moviesCreated;
    }

    await this.prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    this.logger.log(
      `Created ${rows.length} notification(s) across ${users.size} user(s)`,
    );

    return rows.length + moviesCreated;
  }

  /**
   * Works the refresh job saw join a saga already saved (see SagaSyncService):
   * tells everyone who finished part of that saga, unless they already track
   * the new work. Each announcement goes out once.
   */
  private async scanSagaSequels(): Promise<number> {
    const announced = await this.prisma.sagaMember.findMany({
      where: { announcedAt: { not: null }, notifiedAt: null },
      include: { saga: { select: { title: true } } },
    });
    let created = 0;

    for (const work of announced) {
      // An 18+ work would need each recipient's age gate: left unannounced.
      const recipients = work.isAdult
        ? []
        : await this.prisma.libraryEntry.findMany({
            where: {
              finishedAt: { not: null },
              status: { not: "DROPPED" },
              mediaItem: { sagaKey: work.sagaKey },
              user: {
                enabledDomains: { has: "MEDIA" },
                entries: {
                  none: {
                    mediaItem: {
                      externalIds: {
                        some: {
                          source: work.source,
                          type: work.type,
                          externalId: work.sourceId,
                        },
                      },
                    },
                  },
                },
              },
            },
            distinct: ["userId"],
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  locale: true,
                  alertPrefs: true,
                  suspendedUntil: true,
                },
              },
            },
          });
      created += await this.announceSequel(
        { ...work, sagaTitle: work.saga.title },
        recipients.map((r) => r.user),
        `/app/media/${work.type.toLowerCase()}/${work.sourceId}`,
      );

      await this.prisma.sagaMember.update({
        where: { id: work.id },
        data: { notifiedAt: new Date() },
      });
    }

    return created;
  }

  /** The same alert for a game announced in a series: its finishers are told. */
  private async scanGameSagaSequels(): Promise<number> {
    const announced = await this.prisma.gameSagaMember.findMany({
      where: { announcedAt: { not: null }, notifiedAt: null },
      include: { saga: { select: { title: true } } },
    });
    let created = 0;

    for (const game of announced) {
      // An 18+ game would need each recipient's age gate: left unannounced.
      const recipients = game.isAdult
        ? []
        : await this.prisma.gameEntry.findMany({
            where: {
              finishedAt: { not: null },
              status: { not: "DROPPED" },
              gameItem: { sagaKey: game.sagaKey },
              user: {
                enabledDomains: { has: "GAMES" },
                gameEntries: {
                  none: {
                    gameItem: {
                      externalIds: {
                        some: { source: "IGDB", externalId: game.sourceId },
                      },
                    },
                  },
                },
              },
            },
            distinct: ["userId"],
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  locale: true,
                  alertPrefs: true,
                  suspendedUntil: true,
                },
              },
            },
          });

      created += await this.announceSequel(
        { ...game, sagaTitle: game.saga.title },
        recipients.map((r) => r.user),
        `/app/games/${game.sourceId}`,
      );

      await this.prisma.gameSagaMember.update({
        where: { id: game.id },
        data: { notifiedAt: new Date() },
      });
    }

    return created;
  }

  /** Rings, pushes and, when switched on, emails each finisher of the saga. */
  private async announceSequel(
    work: {
      title: string;
      sagaKey: string;
      sourceId: string;
      sagaTitle: string;
    },
    recipients: {
      id: string;
      email: string;
      locale: string;
      alertPrefs: unknown;
      suspendedUntil: Date | null;
    }[],
    url: string,
  ): Promise<number> {
    for (const user of recipients) {
      await this.create({
        userId: user.id,
        type: NotificationType.SAGA_SEQUEL_ANNOUNCED,
        title: work.title,
        body: notificationCopy(user.locale).sagaSequel(work.sagaTitle),
        url,
        dedupeKey: `saga-sequel:${work.sagaKey}:${work.sourceId}`,
        data: { sagaKey: work.sagaKey, sagaTitle: work.sagaTitle },
      });

      if (
        !isSuspended(user) &&
        isAlertEnabled(
          user.alertPrefs as AlertPrefs,
          NotificationType.SAGA_SEQUEL_ANNOUNCED,
          "email",
        )
      ) {
        try {
          await this.mail.sendSagaSequel(user, work.title, work.sagaTitle, url);
        } catch (err) {
          this.logger.error(`Sequel email failed for ${user.id}`, err);
        }
      }
    }

    return recipients.length;
  }

  private async scanMovies(userId?: string): Promise<number> {
    const now = new Date();
    const since = utcDateKey(sinceDaysAgo(now, WINDOW_DAYS));
    const today = utcDateKey(now);
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        movieReleaseReminderAt: { not: null },
        status: { not: "DROPPED" },
        mediaItem: { type: "MOVIE" },
        user: {
          enabledDomains: { has: "MEDIA" },
          OR: [
            { notifyPush: { not: DigestCadence.DISABLED } },
            { notifyEmail: { not: DigestCadence.DISABLED } },
          ],
        },
      },
      include: {
        mediaItem: { include: { externalIds: true } },
        user: { select: { watchRegion: true, locale: true } },
      },
    });
    const rows: Prisma.NotificationCreateManyInput[] = entries.flatMap(
      (entry) => {
        const region = resolveWatchRegion(
          entry.user.watchRegion ?? entry.movieReleaseRegion ?? undefined,
          undefined,
        );
        const release = movieReleaseInfo(
          movieReleaseDates(entry.mediaItem.movieReleaseDates),
          entry.mediaItem.status,
          region,
          now,
        );
        if (
          !entry.movieReleaseReminderAt ||
          !release.localDate ||
          release.localDate <= since ||
          release.localDate > today ||
          release.localDate < utcDateKey(entry.movieReleaseReminderAt)
        )
          return [];
        const body = notificationCopy(entry.user.locale).movieRelease(
          release.localType!,
          region,
        );
        return [
          {
            userId: entry.userId,
            type: NotificationType.NEW_MOVIE,
            title: entry.mediaItem.title,
            body,
            url: `/app/media/movie/${canonicalExternalId(entry.mediaItem, entry.mediaItem.externalIds)}`,
            dedupeKey: `movie:${entry.mediaItemId}`,
            data: {
              airDate: `${release.localDate}T00:00:00.000Z`,
              mediaItemId: entry.mediaItemId,
              region,
              releaseType: release.localType,
            },
          },
        ];
      },
    );
    if (rows.length === 0) return 0;
    const created = await this.prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return created.count;
  }

  /**
   * Releases of the games their players asked to be told about, on the day —
   * or on the 1st, for a game dated to a month. A vaguer date alerts nothing
   * until IGDB narrows it.
   */
  private async scanGames(userId?: string): Promise<number> {
    const now = new Date();
    const since = sinceDaysAgo(now, WINDOW_DAYS);
    const today = utcDateKey(now);
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId,
        releaseReminderAt: { not: null },
        status: { not: "DROPPED" },
        gameItem: {
          releaseDatePrecision: { in: ["DAY", "MONTH"] },
          releaseDate: { gt: since, lte: now },
        },
        user: {
          enabledDomains: { has: "GAMES" },
          OR: [
            { notifyPush: { not: DigestCadence.DISABLED } },
            { notifyEmail: { not: DigestCadence.DISABLED } },
          ],
        },
      },
      include: {
        gameItem: { include: { externalIds: true } },
        user: { select: { locale: true } },
      },
    });
    const rows: Prisma.NotificationCreateManyInput[] = entries.flatMap(
      (entry) => {
        const { gameItem } = entry;
        const day = gameReleaseAlertDay(
          gameItem.releaseDate ? utcDateKey(gameItem.releaseDate) : null,
          gameItem.releaseDatePrecision,
        );
        if (!day || day > today || day < utcDateKey(entry.releaseReminderAt!))
          return [];
        return [
          {
            userId: entry.userId,
            type: NotificationType.NEW_GAME,
            title: gameItem.title,
            body: notificationCopy(entry.user.locale).gameRelease(
              gameItem.releaseDatePrecision === "MONTH",
            ),
            url: `/app/games/${canonicalExternalId(gameItem, gameItem.externalIds)}`,
            dedupeKey: `game:${entry.gameItemId}`,
            data: {
              airDate: `${day}T00:00:00.000Z`,
              gameItemId: entry.gameItemId,
            },
          },
        ];
      },
    );
    if (rows.length === 0) return 0;
    const created = await this.prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return created.count;
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

    const gamesCreated = user.enabledDomains.includes("GAMES")
      ? await this.scanGames(userId)
      : 0;

    // Episode alerts belong to the MEDIA domain: a user who disabled it gets
    // none. Filtered here (not by hiding the feed) so other notification types
    // stay available.
    if (!user.enabledDomains.includes("MEDIA")) return gamesCreated;

    const moviesCreated = (await this.scanMovies(userId)) + gamesCreated;

    const now = new Date();
    const since = sinceDaysAgo(now, WINDOW_DAYS);

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

    if (episodes.length === 0) return moviesCreated;

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

    if (toCreate.length === 0) return moviesCreated;

    await this.prisma.notification.createMany({
      data: this.episodeNotificationRows(userId, toCreate),
      skipDuplicates: true,
    });

    return toCreate.length + moviesCreated;
  }

  /**
   * Creates one in-app notification. Idempotent per `dedupeKey` (a re-follow or
   * a re-scan won't duplicate a row). Used by other domains (e.g. social) to
   * post notifications without knowing the storage shape.
   */
  async create(input: CreateNotificationInput): Promise<void> {
    if (await this.createInTransaction(this.prisma, input)) {
      this.publishCreated(input.userId, input.type);
      await this.pushIfWanted(input);
    }
  }

  /**
   * Like {@link create}, but folds into the recipient's unread row with the
   * same `dedupeKey` rather than adding another: `regroup` rewrites it for
   * the new total, and the row moves back to the top. Only the first one
   * pushes.
   */
  async createOrGroup(
    input: CreateNotificationInput & { dedupeKey: string },
    regroup: (count: number) => Pick<CreateNotificationInput, "body" | "data">,
  ): Promise<void> {
    const existing = await this.prisma.notification.findUnique({
      where: {
        userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey },
      },
      select: { id: true, data: true },
    });

    if (!existing) return this.create(input);

    const previous = (existing.data ?? {}) as Record<string, unknown>;
    const count = (typeof previous.count === "number" ? previous.count : 1) + 1;
    const { body, data } = regroup(count);

    await this.prisma.notification.update({
      where: { id: existing.id },
      data: {
        body: body ?? null,
        data: { ...(data ?? {}), count } as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });
    this.publishCreated(input.userId, input.type);
  }

  /** Pushes a new bell entry too, when the recipient chose to for its kind. */
  private async pushIfWanted(input: CreateNotificationInput): Promise<void> {
    if (!isAlertToggleable(input.type, "push")) return;

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { locale: true, alertPrefs: true, suspendedUntil: true },
    });

    if (
      !user ||
      isSuspended(user) ||
      !isAlertEnabled(user.alertPrefs as AlertPrefs, input.type, "push")
    ) {
      return;
    }

    try {
      await this.push.sendToUser(input.userId, {
        title: pushTitle(input, notificationCopy(user.locale)),
        body: input.body ?? "",
        url: input.url ?? "/app",
      });
    } catch (err) {
      // The bell entry is saved: a push service failing mustn't fail the
      // action that caused it.
      this.logger.error(`Push failed for ${input.userId}`, err);
    }
  }

  /** Persists a notification alongside the caller's transaction; publish only after commit. */
  async createInTransaction(
    db: PrismaService | Prisma.TransactionClient,
    input: CreateNotificationInput,
  ): Promise<boolean> {
    const { count } = await db.notification.createMany({
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

    return count > 0;
  }

  publishCreated(userId: string, type: NotificationType): void {
    // Kinds excluded from the bell feed have nothing useful to refetch.
    if (!FEED_EXCLUDED_TYPES.includes(type)) {
      this.events.emitToUser(userId, "notification");
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

/** A comment's bell entry is titled with its author alone: the push says why. */
function pushTitle(
  input: CreateNotificationInput,
  copy: NotificationCopy,
): string {
  switch (input.type) {
    case NotificationType.COMMENT_REPLY:
      return copy.pushTitle.commentReply(input.title);
    case NotificationType.COMMENT_MENTION:
      return copy.pushTitle.commentMention(input.title);
    default:
      return input.title;
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
