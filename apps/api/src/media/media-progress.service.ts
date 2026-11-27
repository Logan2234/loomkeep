import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  type LibraryEntryDto,
  type ProgressDto,
} from "@loomkeep/shared/contracts";
import {
  type CatalogSource,
  EntryStatus,
  type MediaOwnershipStatus,
  MediaType,
  XpReason,
} from "@loomkeep/shared/enums";
import { sagaCompletionXp } from "../gamification/xp-rules";

import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  ExternalSource as DbExternalSource,
  Prisma,
} from "@prisma/client";
import { AppException } from "../common/app.exception";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { assertEntryOwnership } from "../work/entry-lifecycle.util";
import { resolveWatchRegion } from "./watch-region.util";

import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/triggers";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { preferencesOf } from "../users/preferences.util";
import {
  isLoanActive,
  LOAN_INCLUDE,
  loanFields,
} from "../work/entry-loan.util";
import { toMediaItemDto } from "./media-item.mapper";
import { completedSagaWorks, MEDIA_SAGA_STATUS } from "./saga-progress.util";
import { deriveStatus, normalizeAiringFinished } from "./status.util";

import {
  EntryWithMedia,
  inViewing,
  materializedProgress,
  nextEpisodeOf,
  seenInViewing,
  toReplayDto,
} from "./media-entries.util";

/**
 * What every part of a media entry builds on: its progress (watched
 * episodes, rewatch, next episode), the DTO it is sent as, ownership checks
 * and the saga bonus. Shared by the library, episode and detail services.
 */
@Injectable()
export class MediaProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
  ) {}

  /**
   * Keeps `finishedAt` in sync with "has the viewer finished this work":
   * nothing in the UI sets it directly, but `CommentService.isMasked` reads
   * it for the work-level spoiler gate on MEDIA-target threads, so without
   * this a finished movie/series' discussion stays blurred forever. Movies
   * follow the raw COMPLETED status; series/anime follow watch progress
   * reaching the end (UP_TO_DATE counts too — everything released has been
   * seen, even if the show is still airing).
   */
  async syncFinishedAt(
    userId: string,
    mediaItemId: string,
    type: MediaType,
  ): Promise<Date | null> {
    const entry = await this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      select: { status: true, finishedAt: true },
    });
    if (!entry) return null;

    let finished: boolean;

    if (type === "MOVIE") {
      finished = entry.status === "COMPLETED";
    } else {
      const progress = await this.computeProgress(userId, mediaItemId);
      finished =
        !!progress &&
        progress.totalEpisodes > 0 &&
        progress.watchedEpisodes >= progress.totalEpisodes;
    }

    if (finished === !!entry.finishedAt) return entry.finishedAt;

    const finishedAt = finished ? new Date() : null;
    await this.prisma.mediaEntry.update({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      data: { finishedAt },
    });
    return finishedAt;
  }

  /**
   * Create a watch for each of the given episodes the user hasn't watched
   * yet, and credit EPISODE_WATCHED for each newly created watch (the batch
   * still respects the daily cap — see `XpService.awardMany`).
   */
  async watchedEpisodeIds(
    userId: string,
    where: Prisma.EpisodeWatchWhereInput,
  ): Promise<Set<string>> {
    const watches = await this.prisma.episodeWatch.findMany({
      where: { ...where, userId },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    return new Set(watches.map((watch) => watch.episodeId));
  }

  /** When the user's rewatch of this work began, if one is on. */
  async rewatchStartedAt(
    userId: string,
    mediaItemId: string,
  ): Promise<Date | null> {
    const entry = await this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      select: { rewatchStartedAt: true },
    });
    return entry?.rewatchStartedAt ?? null;
  }

  /** A series' rewatch is over once every aired episode was seen again. */
  async endFinishedRewatches(
    userId: string,
    mediaItemIds: string[],
  ): Promise<void> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: {
        userId,
        mediaItemId: { in: mediaItemIds },
        rewatchStartedAt: { not: null },
        mediaItem: { type: { not: MediaType.MOVIE } },
      },
      select: { id: true, mediaItemId: true, rewatchStartedAt: true },
    });

    for (const entry of entries) {
      const progress = await this.computeProgress(
        userId,
        entry.mediaItemId,
        entry.rewatchStartedAt,
      );

      if (progress && !progress.nextEpisode) {
        await this.prisma.mediaEntry.update({
          where: { id: entry.id },
          data: { rewatchStartedAt: null },
        });
      }
    }
  }

  /**
   * The rewatch column an update writes: unchanged when not asked, cleared on
   * stop, kept when already rewatching. Only a title seen to the end starts
   * one. A series' rewatch begins with the viewing that prompted it when its
   * latest viewing saw an episode again (the page asks right after one), and
   * right now otherwise: "season watched" writes a whole run with one
   * timestamp, which would otherwise count as already seen again.
   */
  async rewatchStartedAtFor(
    userId: string,
    entry: {
      mediaItemId: string;
      status: EntryStatus;
      watchedEpisodes: number;
      lastWatchedAt: Date | null;
      rewatchStartedAt: Date | null;
    },
    rewatching: boolean | undefined,
  ): Promise<Date | null | undefined> {
    if (rewatching === undefined) return undefined;
    if (!rewatching) return null;
    if (entry.rewatchStartedAt) return entry.rewatchStartedAt;

    const mediaItem = await this.prisma.mediaItem.findUniqueOrThrow({
      where: { id: entry.mediaItemId },
      select: { type: true, status: true, episodeCount: true },
    });
    const status = deriveStatus(
      mediaItem.type,
      materializedProgress({ ...entry, mediaItem }),
      normalizeAiringFinished(mediaItem.status),
      entry.status,
    );

    if (status !== "COMPLETED" && status !== "UP_TO_DATE") {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.LibraryRewatchNotFinished,
      );
    }

    const latest = entry.lastWatchedAt;
    if (mediaItem.type === "MOVIE" || !latest) return new Date();

    const latestViewings = await this.prisma.episodeWatch.findMany({
      where: {
        userId,
        watchedAt: latest,
        episode: { season: { mediaItemId: entry.mediaItemId } },
      },
      select: { episodeId: true },
    });
    // An undated (imported) viewing predates every dated one.
    const seenBefore = await this.prisma.episodeWatch.count({
      where: {
        userId,
        episodeId: { in: latestViewings.map((w) => w.episodeId) },
        OR: [{ watchedAt: { lt: latest } }, { watchedAt: null }],
      },
    });
    return seenBefore > 0 ? latest : new Date();
  }

  assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.mediaEntry.findUnique({
        where: { id: entryId },
        include: LOAN_INCLUDE,
      }),
    );
  }

  /**
   * Sibling of `assertEntryOwnership` for the watch endpoints, which are
   * addressed by episode/season id and so only know the media item. A missing
   * entry is a 403, never an implicit "track it for them": creating one here
   * would fire WORK_ADDED/DOMAIN_STARTED off a request that never asked to
   * follow the work.
   */
  async assertMediaOwnership(
    userId: string,
    mediaItemId: string,
  ): Promise<void> {
    const entry = await this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      select: { id: true },
    });

    if (!entry) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryEntryForbidden,
      );
    }
  }

  /**
   * SAGA_COMPLETED once the item's saga (a film collection, an anime's main
   * line) has every released work seen and nothing announced. Checked on each
   * finish, the only moment it can become true; once per saga.
   */
  async awardSagaIfCompleted(
    userId: string,
    mediaItemId: string,
  ): Promise<void> {
    const item = await this.prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      select: { sagaKey: true },
    });
    if (!item?.sagaKey) return;
    const saga = await this.prisma.saga.findUnique({
      where: { key: item.sagaKey },
      select: {
        title: true,
        members: { select: { type: true, sourceId: true, upcoming: true } },
      },
    });
    if (!saga) return;

    const statuses = new Map<string, EntryStatus>();

    for (const type of ["MOVIE", "ANIME"] as const) {
      const ids = saga.members
        .filter((m) => m.type === type)
        .map((m) => m.sourceId);
      if (ids.length === 0) continue;
      const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";
      const byId = await this.statusesBySourceId(userId, source, type, ids);
      for (const [id, status] of byId) statuses.set(`${type}:${id}`, status);
    }

    const works = completedSagaWorks(
      saga.members.map((m) => ({
        upcoming: m.upcoming,
        status: statuses.get(`${m.type}:${m.sourceId}`) ?? null,
      })),
      MEDIA_SAGA_STATUS,
    );
    if (works === null) return;

    await this.xp.award(
      userId,
      XpReason.SAGA_COMPLETED,
      item.sagaKey,
      sagaCompletionXp(works),
      { title: saga.title, href: "/app/media?vue=sagas", data: {} },
    );
    await this.achievements.evaluate(
      userId,
      ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.SAGA_COMPLETED],
    );
  }

  /**
   * The viewer's effective status for each of these catalogue works they
   * track, keyed by source id — the same derivation as the library list.
   */
  async statusesBySourceId(
    userId: string,
    source: CatalogSource,
    type: MediaType,
    sourceIds: string[],
  ): Promise<Map<string, EntryStatus>> {
    const externalId = {
      source: source as DbExternalSource,
      type,
      externalId: { in: sourceIds },
    };
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId, mediaItem: { externalIds: { some: externalId } } },
      select: {
        status: true,
        watchedEpisodes: true,
        rewatchStartedAt: true,
        mediaItem: {
          select: {
            type: true,
            status: true,
            episodeCount: true,
            externalIds: {
              where: { source: externalId.source, type },
              select: { externalId: true },
            },
          },
        },
      },
    });

    const statuses = new Map<string, EntryStatus>();

    for (const entry of entries) {
      const sourceId = entry.mediaItem.externalIds[0]?.externalId;
      if (!sourceId) continue;
      statuses.set(
        sourceId,
        deriveStatus(
          entry.mediaItem.type,
          materializedProgress(entry),
          normalizeAiringFinished(entry.mediaItem.status),
          entry.status,
          !!entry.rewatchStartedAt,
        ),
      );
    }

    return statuses;
  }

  /**
   * Batched form of `computeProgress` + `lastWatchedAt` for `listEntries`:
   * that call site was doing 2-3 DB round trips *per entry* (fine for
   * `getEntry`'s single row, but a query storm across a whole library),
   * so this fetches every relevant episode/watch once and reduces them
   * per media item in memory instead.
   */
  async computeProgressBatch(
    userId: string,
    mediaItemIds: string[],
    rewatchStartedAt: Map<string, Date> = new Map(),
  ): Promise<
    Map<string, { progress: ProgressDto | null; lastWatchedAt: Date | null }>
  > {
    const result = new Map<
      string,
      { progress: ProgressDto | null; lastWatchedAt: Date | null }
    >();
    if (mediaItemIds.length === 0) return result;

    const episodes = await this.prisma.episode.findMany({
      where: {
        season: { mediaItemId: { in: mediaItemIds }, number: { gt: 0 } },
      },
      orderBy: [{ season: { number: "asc" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        airDate: true,
        season: { select: { number: true, mediaItemId: true } },
      },
    });
    const episodesByMedia = new Map<string, typeof episodes>();

    for (const e of episodes) {
      const list = episodesByMedia.get(e.season.mediaItemId);
      if (list) list.push(e);
      else episodesByMedia.set(e.season.mediaItemId, [e]);
    }

    // Watches across ALL seasons (specials included) — `lastWatchedAt`
    // tracks any viewing, while progress below only counts regular ones.
    const watches = await this.prisma.episodeWatch.findMany({
      where: {
        userId,
        episode: { season: { mediaItemId: { in: mediaItemIds } } },
      },
      select: {
        episodeId: true,
        watchedAt: true,
        episode: {
          select: { season: { select: { mediaItemId: true, number: true } } },
        },
      },
    });
    const watchedRegularIdsByMedia = new Map<string, Set<string>>();
    const lastWatchedByMedia = new Map<string, Date>();

    for (const w of watches) {
      const mediaItemId = w.episode.season.mediaItemId;

      if (w.watchedAt) {
        const prevLast = lastWatchedByMedia.get(mediaItemId);
        if (!prevLast || w.watchedAt > prevLast)
          lastWatchedByMedia.set(mediaItemId, w.watchedAt);
      }

      const countsForProgress = seenInViewing(
        w.watchedAt,
        rewatchStartedAt.get(mediaItemId) ?? null,
      );

      if (w.episode.season.number > 0 && countsForProgress) {
        const set = watchedRegularIdsByMedia.get(mediaItemId);
        if (set) set.add(w.episodeId);
        else watchedRegularIdsByMedia.set(mediaItemId, new Set([w.episodeId]));
      }
    }

    const now = new Date();

    for (const mediaItemId of mediaItemIds) {
      const mediaEpisodes = episodesByMedia.get(mediaItemId);

      if (!mediaEpisodes || mediaEpisodes.length === 0) {
        result.set(mediaItemId, {
          progress: null,
          lastWatchedAt: lastWatchedByMedia.get(mediaItemId) ?? null,
        });
        continue;
      }

      const watchedIds =
        watchedRegularIdsByMedia.get(mediaItemId) ?? new Set<string>();
      const next = nextEpisodeOf(
        mediaEpisodes,
        watchedIds,
        rewatchStartedAt.has(mediaItemId),
        now,
      );
      result.set(mediaItemId, {
        progress: {
          watchedEpisodes: watchedIds.size,
          totalEpisodes: mediaEpisodes.length,
          nextEpisode: next
            ? {
                episodeId: next.id,
                seasonNumber: next.season.number,
                episodeNumber: next.number,
              }
            : null,
        },
        lastWatchedAt: lastWatchedByMedia.get(mediaItemId) ?? null,
      });
    }

    return result;
  }

  /**
   * Season 0 holds specials on TMDB: they are watchable but excluded from the
   * watched/total progress so "100%" means the regular run is complete.
   */
  async computeProgress(
    userId: string,
    mediaItemId: string,
    rewatchStartedAt: Date | null = null,
  ): Promise<ProgressDto | null> {
    const regularEpisodes: Prisma.EpisodeWhereInput = {
      season: { mediaItemId, number: { gt: 0 } },
    };

    const episodes = await this.prisma.episode.findMany({
      where: regularEpisodes,
      orderBy: [{ season: { number: "asc" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        airDate: true,
        season: { select: { number: true } },
      },
    });

    if (episodes.length === 0) {
      return null; // Movies (or media without any episode listing).
    }

    // During a rewatch only the viewings since it began count.
    const watchedIds = await this.watchedEpisodeIds(userId, {
      episode: regularEpisodes,
      ...inViewing(rewatchStartedAt),
    });

    const next = nextEpisodeOf(
      episodes,
      watchedIds,
      !!rewatchStartedAt,
      new Date(),
    );

    return {
      watchedEpisodes: watchedIds.size,
      totalEpisodes: episodes.length,
      nextEpisode: next
        ? {
            episodeId: next.id,
            seasonNumber: next.season.number,
            episodeNumber: next.number,
          }
        : null,
    };
  }

  /** Most recent viewing of a media (max episode watch), or null if never. */
  async lastWatchedAt(
    userId: string,
    mediaItemId: string,
  ): Promise<Date | null> {
    const agg = await this.prisma.episodeWatch.aggregate({
      where: { userId, episode: { season: { mediaItemId } } },
      _max: { watchedAt: true },
    });
    return agg._max.watchedAt;
  }

  toEntryDto(
    entry: EntryWithMedia,
    progress: ProgressDto | null,
    watchedAt: Date | null,
    rating: number | null,
    translatedTitle?: string,
  ): LibraryEntryDto {
    const media = entry.mediaItem;
    const status = deriveStatus(
      media.type,
      progress,
      normalizeAiringFinished(media.status),
      entry.status,
      !!entry.rewatchStartedAt,
    );
    // Movies have no episode watches: fall back to when it was marked finished.
    const lastWatchedAt = watchedAt ?? entry.finishedAt;
    return {
      id: entry.id,
      mediaItem: toMediaItemDto(media, translatedTitle),
      status,
      rating,
      notes: entry.notes,
      favorite: entry.favorite,
      startedAt: entry.startedAt?.toISOString() ?? null,
      finishedAt: entry.finishedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      lastWatchedAt: lastWatchedAt?.toISOString() ?? null,
      progress,
      ownershipStatus: entry.ownershipStatus as MediaOwnershipStatus,
      ownershipSource: entry.ownershipSource,
      ...loanFields(entry),
      loanActive: isLoanActive(entry),
      episodeAlertsMuted: entry.episodeAlertsMuted,
      rewatching: !!entry.rewatchStartedAt,
      ...(entry.movieReleaseReminderAt
        ? { movieReleaseAlertsEnabled: true }
        : {}),
      replays: entry.replays.map(toReplayDto),
    };
  }

  async movieRegion(userId: string, acceptLanguage?: string): Promise<string> {
    const user = preferencesOf(
      await this.prisma.userPreferences.findUnique({
        where: { userId: userId },
        select: { watchRegion: true },
      }),
    );
    return resolveWatchRegion(user.watchRegion ?? undefined, acceptLanguage);
  }
}
