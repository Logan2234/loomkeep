import type {
  CalendarEntryDto,
  CatalogSource,
  EntryEpisodesResponseDto,
  EntryStatus,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaDetailDto,
  MediaItemDto,
  MediaType,
  MovieReplayDto,
  PagedResult,
  ProgressDto,
} from "@loomkeep/shared";
import {
  ActivityType,
  ErrorCode,
  isDormant,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  ExternalSource as DbExternalSource,
  LibraryEntry,
  MediaExternalId,
  MediaItem,
  MovieReplay,
  Prisma,
} from "@prisma/client";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
import { ActivityService } from "../social/activity.service";
import { AgeGateService } from "../users/age-gate.service";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
import { buildCalendarIcs } from "./ics.util";
import { deriveStatus, normalizeAiringFinished } from "./status.util";

// Reused include: entries always need the media + its external IDs (sourceId),
// plus their replay history (movies only in practice), most recent first.
const ENTRY_INCLUDE = {
  mediaItem: { include: { externalIds: true } },
  replays: { orderBy: { finishedAt: "desc" } },
} satisfies Prisma.LibraryEntryInclude;

/** LibraryEntry joined with its media and the media's external IDs. */
type EntryWithMedia = Prisma.LibraryEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

const PAGE_SIZE = 40;

type MediaSortKey =
  | "recent"
  | "added"
  | "title"
  | "rating"
  | "progress"
  | "finished"
  | "started"
  | "status";
const MEDIA_SORT_KEYS: MediaSortKey[] = [
  "recent",
  "added",
  "title",
  "rating",
  "progress",
  "finished",
  "started",
  "status",
];
// Order used by the "Statut" sort.
const MEDIA_STATUS_SORT_ORDER: EntryStatus[] = [
  "WATCHING",
  "PLANNED",
  "UP_TO_DATE",
  "COMPLETED",
  "DROPPED",
];

export interface ListEntriesFilters {
  q?: string;
  favorite?: boolean;
  /** "DORMANT" is accepted alongside real `EntryStatus` values — see `isDormant`. */
  statuses?: string[];
  types?: MediaType[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  /** The signed-in user's locale, when known — see `MediaItemService.translatedTitles`. */
  lang?: string;
}

function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function mediaProgressPct(entry: LibraryEntryDto): number {
  if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
  return Math.round(
    (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
  );
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareMediaEntries(
  sort: MediaSortKey,
  a: LibraryEntryDto,
  b: LibraryEntryDto,
): number {
  switch (sort) {
    case "title":
      return a.mediaItem.title.localeCompare(b.mediaItem.title, "fr");
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "progress":
      return mediaProgressPct(b) - mediaProgressPct(a);
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "started":
      return timeMs(b.startedAt) - timeMs(a.startedAt);
    case "status":
      return (
        MEDIA_STATUS_SORT_ORDER.indexOf(a.status) -
        MEDIA_STATUS_SORT_ORDER.indexOf(b.status)
      );
    case "added":
      return b.createdAt.localeCompare(a.createdAt);
    case "recent":
      return timeMs(b.lastWatchedAt) - timeMs(a.lastWatchedAt);
  }
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
    private readonly entitlements: EntitlementService,
    private readonly xp: XpService,
  ) {}

  /** First touch of a media persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertEntryDto,
  ): Promise<LibraryEntryDto> {
    const mediaItem = await this.mediaItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
      dto.type,
    );

    const before = await this.prisma.libraryEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      update: changes,
      create: { userId, mediaItemId: mediaItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    entry.finishedAt = await this.syncFinishedAt(
      userId,
      mediaItem.id,
      mediaItem.type,
    );

    await this.emitEntryActivity(userId, mediaItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    // The /10 rating lives in Review (the single source of truth).
    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
        dto.rating,
      );
    }

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, mediaItem.id),
      await this.lastWatchedAt(userId, mediaItem.id),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
      ),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<LibraryEntryDto>> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        mediaItem:
          filters.types && filters.types.length > 0
            ? { type: { in: filters.types } }
            : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const mediaItemIds = entries.map((e) => e.mediaItemId);
    const [ratings, progressByMedia, translatedTitles] = await Promise.all([
      this.reviews.getRatings(userId, ReviewTargetType.MEDIA, mediaItemIds),
      this.computeProgressBatch(userId, mediaItemIds),
      filters.lang
        ? this.mediaItemService.translatedTitles(mediaItemIds, filters.lang)
        : Promise.resolve(new Map<string, string>()),
    ]);
    const dtos = entries.map((entry) => {
      const p = progressByMedia.get(entry.mediaItemId);
      return this.toEntryDto(
        entry,
        p?.progress ?? null,
        p?.lastWatchedAt ?? null,
        ratings.get(entry.mediaItemId) ?? null,
        translatedTitles.get(entry.mediaItemId),
      );
    });

    // Status is derived, so filter on the effective status, not the stored
    // one — "DORMANT" is a synthetic refinement of WATCHING (see isDormant).
    const q = filters.q?.trim().toLowerCase();
    const filtered = dtos.filter((dto) => {
      if (
        filters.statuses &&
        filters.statuses.length > 0 &&
        !filters.statuses.some((s) =>
          s === "DORMANT" ? isDormant(dto) : dto.status === s,
        )
      )
        return false;
      if (filters.favorite && !dto.favorite) return false;
      if (q && !dto.mediaItem.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sort = MEDIA_SORT_KEYS.includes(filters.sort as MediaSortKey)
      ? (filters.sort as MediaSortKey)
      : "recent";
    const asc = filters.order === "asc";
    filtered.sort((a, b) => {
      const c = compareMediaEntries(sort, a, b);
      return asc ? -c : c;
    });

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? filters.limit : PAGE_SIZE;
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      hasMore: filtered.length > page * limit,
    };
  }

  async getEntry(userId: string, entryId: string): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.libraryEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, entry.mediaItemId),
      await this.lastWatchedAt(userId, entry.mediaItemId),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
      ),
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateEntryDto,
  ): Promise<LibraryEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const before = await this.prisma.libraryEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true },
    });

    const entry = await this.prisma.libraryEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: dto.ownershipSource,
      },
      include: ENTRY_INCLUDE,
    });

    // Only auto-derive when the caller didn't explicitly set finishedAt
    // themselves (e.g. a future manual-date editor).
    if (dto.finishedAt === undefined) {
      entry.finishedAt = await this.syncFinishedAt(
        userId,
        entry.mediaItemId,
        entry.mediaItem.type,
      );
    }

    await this.emitEntryActivity(userId, entry.mediaItemId, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
        dto.rating,
      );
    }

    return this.toEntryDto(
      entry,
      await this.computeProgress(userId, entry.mediaItemId),
      await this.lastWatchedAt(userId, entry.mediaItemId),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
      ),
    );
  }

  /**
   * Removing a work wipes everything the user attached to it, not just the
   * entry row itself: watches/reviews/comments key off (userId, targetId)
   * rather than the entry, so they'd otherwise survive re-adding the same
   * work later. `notes`/`ownershipStatus`/`ownershipSource` are plain
   * columns on the entry itself and need no separate cleanup. Comments are
   * soft-deleted (same tombstone as a manual delete) rather than hard
   * removed, so replies from other users stay attached instead of cascading
   * away. targetId alone is enough to scope every table below — cuids are
   * globally unique, so there's no need to also filter by targetType.
   */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: entry.mediaItemId },
      select: { id: true, episodes: { select: { id: true } } },
    });
    const episodeIds = seasons.flatMap((s) => s.episodes.map((e) => e.id));
    const targetIds = [
      entry.mediaItemId,
      ...seasons.map((s) => s.id),
      ...episodeIds,
    ];

    // Loaded before the transaction so revokeBySource has something to work
    // with once the watches are gone — see the [G1] plan: XP writes never
    // happen inside a $transaction (no side effect in the lock, same as
    // `activity.emit` elsewhere in this file, always awaited after one).
    const watches = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodeIds } },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: { userId, episodeId: { in: episodeIds } },
      }),
      this.prisma.review.deleteMany({
        where: { userId, targetId: { in: targetIds } },
      }),
      this.prisma.comment.updateMany({
        where: {
          authorId: userId,
          targetId: { in: targetIds },
          deletedAt: null,
        },
        data: { text: null, deletedAt: new Date() },
      }),
      this.prisma.libraryEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource(
      "EpisodeWatch",
      watches.map((w) => w.id),
    );
  }

  /**
   * Emits the activity events for a media entry write: a status milestone (via
   * the shared transition rules) and, separately, a FAVORITED event when a work
   * is newly favourited (profile-timeline only, per the matrix).
   */
  private async emitEntryActivity(
    userId: string,
    mediaItemId: string,
    change: {
      prevStatus: string | null;
      nextStatus: string;
      prevFavorite: boolean;
      nextFavorite: boolean;
    },
  ): Promise<void> {
    const transition = classifyStatusTransition(
      "MEDIA",
      change.prevStatus,
      change.nextStatus,
    );

    if (transition) {
      await this.activity.emit({
        userId,
        type: transition.type,
        domain: "MEDIA",
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        homeFeed: transition.homeFeed,
      });
    }

    if (change.nextFavorite && !change.prevFavorite) {
      await this.activity.emit({
        userId,
        type: ActivityType.FAVORITED,
        domain: "MEDIA",
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        homeFeed: false,
      });
    }
  }

  /**
   * Keeps `finishedAt` in sync with "has the viewer finished this work":
   * nothing in the UI sets it directly, but `CommentService.isMasked` reads
   * it for the work-level spoiler gate on MEDIA-target threads, so without
   * this a finished movie/series' discussion stays blurred forever. Movies
   * follow the raw COMPLETED status; series/anime follow watch progress
   * reaching the end (UP_TO_DATE counts too — everything released has been
   * seen, even if the show is still airing).
   */
  private async syncFinishedAt(
    userId: string,
    mediaItemId: string,
    type: MediaType,
  ): Promise<Date | null> {
    const entry = await this.prisma.libraryEntry.findUnique({
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
    await this.prisma.libraryEntry.update({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      data: { finishedAt },
    });
    return finishedAt;
  }

  /** Persisted seasons/episodes of an entry's media, with the user's watch counts. */
  async getEntryEpisodes(
    userId: string,
    entryId: string,
  ): Promise<EntryEpisodesResponseDto> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: entry.mediaItemId },
      orderBy: { number: "asc" },
      include: {
        episodes: {
          orderBy: { number: "asc" },
          include: { watches: { where: { userId }, select: { id: true } } },
        },
      },
    });

    return {
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          watchCount: episode.watches.length,
        })),
      })),
    };
  }

  async watchEpisode(
    userId: string,
    episodeId: string,
    dto: WatchEpisodeDto,
  ): Promise<EpisodeWatchDto> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        season: {
          select: { mediaItemId: true, mediaItem: { select: { type: true } } },
        },
      },
    });

    if (!episode) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEpisodeNotFound,
      );
    }

    if (episode.airDate && episode.airDate > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    const watch = await this.prisma.episodeWatch.create({
      data: {
        userId,
        episodeId,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : undefined,
      },
    });

    await this.xp.award(userId, XpReason.EPISODE_WATCHED, watch.id);

    await this.syncFinishedAt(
      userId,
      episode.season.mediaItemId,
      episode.season.mediaItem.type,
    );

    await this.activity.emit({
      userId,
      type: ActivityType.PROGRESS,
      domain: "MEDIA",
      targetType: ReviewTargetType.MEDIA,
      targetId: episode.season.mediaItemId,
      level: "EPISODE",
      homeFeed: true,
    });

    return {
      id: watch.id,
      episodeId: watch.episodeId,
      watchedAt: watch.watchedAt.toISOString(),
    };
  }

  /**
   * Mark every not-yet-watched episode of a season as watched in one go.
   * Already-watched episodes are skipped so this never inflates rewatch counts.
   */
  async watchSeason(userId: string, seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { mediaItemId: true, mediaItem: { select: { type: true } } },
    });
    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true, airDate: true },
    });

    if (!season || episodes.length === 0) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySeasonEmpty,
      );
    }

    // Unreleased episodes (future airDate) are silently skipped rather than
    // blocking the whole season.
    const now = new Date();
    const airedIds = episodes
      .filter((e) => !e.airDate || e.airDate <= now)
      .map((e) => e.id);
    await this.markUnwatched(userId, airedIds);
    await this.syncFinishedAt(
      userId,
      season.mediaItemId,
      season.mediaItem.type,
    );
  }

  /**
   * Undo a whole season: removes every watch the user has recorded for its
   * episodes (all rewatches included, not just the latest one per episode).
   */
  async unwatchSeason(userId: string, seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { mediaItemId: true, mediaItem: { select: { type: true } } },
    });

    if (!season) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySeasonNotFound,
        undefined,
        "Season not found",
      );
    }

    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true },
    });

    // Loaded before the deleteMany so revokeBySource still has the ids to
    // work with afterwards (see the [G1] plan: never award/revoke inside a
    // transaction, and here there's nothing left to look up post-delete).
    const watches = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
      select: { id: true },
    });

    await this.prisma.episodeWatch.deleteMany({
      where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
    });
    await this.xp.revokeBySource(
      "EpisodeWatch",
      watches.map((w) => w.id),
    );
    await this.syncFinishedAt(
      userId,
      season.mediaItemId,
      season.mediaItem.type,
    );
  }

  /**
   * "Watch up to here": mark every regular episode of the series from the start
   * up to and including the given one (specials excluded — they are not part of
   * the linear run). If the target itself is a special, only it is marked.
   */
  async watchThrough(userId: string, episodeId: string): Promise<void> {
    const target = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        season: { include: { mediaItem: { select: { type: true } } } },
      },
    });

    if (!target) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEpisodeNotFound,
      );
    }

    if (target.airDate && target.airDate > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    if (target.season.number === 0) {
      await this.markUnwatched(userId, [episodeId]);
    } else {
      const episodes = await this.prisma.episode.findMany({
        where: {
          season: { mediaItemId: target.season.mediaItemId, number: { gt: 0 } },
        },
        select: {
          id: true,
          number: true,
          airDate: true,
          season: { select: { number: true } },
        },
      });
      const now = new Date();
      const throughIds = episodes
        .filter(
          (e) =>
            (e.season.number < target.season.number ||
              (e.season.number === target.season.number &&
                e.number <= target.number)) &&
            (!e.airDate || e.airDate <= now),
        )
        .map((e) => e.id);
      await this.markUnwatched(userId, throughIds);
    }

    await this.syncFinishedAt(
      userId,
      target.season.mediaItemId,
      target.season.mediaItem.type,
    );
  }

  /**
   * Create a watch for each of the given episodes the user hasn't watched
   * yet, and credit EPISODE_WATCHED for each newly created watch (the batch
   * still respects the daily cap — see `XpService.awardMany`).
   */
  private async markUnwatched(
    userId: string,
    episodeIds: string[],
  ): Promise<void> {
    if (episodeIds.length === 0) return;
    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodeIds } },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const watchedIds = new Set(watched.map((w) => w.episodeId));
    const newEpisodeIds = episodeIds.filter((id) => !watchedIds.has(id));
    const toCreate = newEpisodeIds.map((id) => ({ userId, episodeId: id }));

    if (toCreate.length > 0) {
      await this.prisma.episodeWatch.createMany({ data: toCreate });
      const created = await this.prisma.episodeWatch.findMany({
        where: { userId, episodeId: { in: newEpisodeIds } },
        select: { id: true },
      });
      await this.xp.awardMany(
        userId,
        XpReason.EPISODE_WATCHED,
        created.map((w) => w.id),
      );
    }
  }

  /**
   * Upcoming episodes (air date today or later) of the series/anime the user
   * tracks, excluding dropped ones — the release calendar.
   */
  async getCalendar(userId: string): Promise<CalendarEntryDto[]> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gte: startOfToday },
        season: {
          mediaItem: {
            entries: { some: { userId, status: { not: "DROPPED" } } },
          },
        },
      },
      orderBy: { airDate: "asc" },
      take: 60,
      include: {
        season: {
          include: { mediaItem: { include: { externalIds: true } } },
        },
      },
    });

    return episodes.map((episode) => ({
      mediaItem: toMediaItemDto(episode.season.mediaItem),
      seasonNumber: episode.season.number,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      // airDate is guaranteed non-null by the `gte` filter above.
      airDate: episode.airDate!.toISOString(),
    }));
  }

  /**
   * Renders the same feed as getCalendar() as an .ics file, for the public
   * token-based subscription URL (see LibraryController#getCalendarIcs).
   * Returns null if the token doesn't match any account.
   */
  async getCalendarIcs(token: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true },
    });

    // Re-checked here, not just at token issuance (UsersController), so a
    // downgraded premium account's calendar app stops getting fed the moment
    // its plan changes, instead of forever on a token minted while premium.
    if (!user || !(await this.entitlements.isEffectivelyPremium(user.id))) {
      return null;
    }

    return buildCalendarIcs(await this.getCalendar(user.id));
  }

  /**
   * Undo watching an episode: removes the user's most recent watch for it
   * (so it decrements a rewatch count, and unwatches the episode at one watch).
   */
  async unwatchEpisode(userId: string, episodeId: string): Promise<void> {
    const latest = await this.prisma.episodeWatch.findFirst({
      where: { userId, episodeId },
      orderBy: { watchedAt: "desc" },
      include: {
        episode: {
          include: {
            season: { include: { mediaItem: { select: { type: true } } } },
          },
        },
      },
    });

    if (!latest) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryNoWatchToUndo,
      );
    }

    await this.prisma.episodeWatch.delete({ where: { id: latest.id } });
    await this.xp.revokeBySource("EpisodeWatch", [latest.id]);
    await this.syncFinishedAt(
      userId,
      latest.episode.season.mediaItemId,
      latest.episode.season.mediaItem.type,
    );
  }

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<LibraryEntry> {
    const entry = await this.prisma.libraryEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEntryNotFound,
      );
    }

    if (entry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryEntryForbidden,
      );
    }

    return entry;
  }

  /**
   * Season 0 holds specials on TMDB: they are watchable but excluded from the
   * watched/total progress so "100%" means the regular run is complete.
   */
  /**
   * Batched form of `computeProgress` + `lastWatchedAt` for `listEntries`:
   * that call site was doing 2-3 DB round trips *per entry* (fine for
   * `getEntry`'s single row, but a query storm across a whole library),
   * so this fetches every relevant episode/watch once and reduces them
   * per media item in memory instead.
   */
  private async computeProgressBatch(
    userId: string,
    mediaItemIds: string[],
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
      const prevLast = lastWatchedByMedia.get(mediaItemId);
      if (!prevLast || w.watchedAt > prevLast)
        lastWatchedByMedia.set(mediaItemId, w.watchedAt);

      if (w.episode.season.number > 0) {
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
      const next = mediaEpisodes.find(
        (e) =>
          !watchedIds.has(e.id) && (e.airDate === null || e.airDate <= now),
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

  private async computeProgress(
    userId: string,
    mediaItemId: string,
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

    const watched = await this.prisma.episodeWatch.findMany({
      where: { userId, episode: regularEpisodes },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const watchedIds = new Set(watched.map((w) => w.episodeId));

    // Next up: first unwatched episode that has aired (null airDate = AniList's
    // generated episodes, treated as available).
    const now = new Date();
    const next = episodes.find(
      (e) => !watchedIds.has(e.id) && (e.airDate === null || e.airDate <= now),
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
  private async lastWatchedAt(
    userId: string,
    mediaItemId: string,
  ): Promise<Date | null> {
    const agg = await this.prisma.episodeWatch.aggregate({
      where: { userId, episode: { season: { mediaItemId } } },
      _max: { watchedAt: true },
    });
    return agg._max.watchedAt;
  }

  private toEntryDto(
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
      ownershipStatus: entry.ownershipStatus,
      ownershipSource: entry.ownershipSource,
      replays: entry.replays.map(toReplayDto),
    };
  }

  /**
   * Log a completed rewatch (a completion beyond the entry's first one).
   * Movies only — series/anime rewatches are tracked per-episode via
   * EpisodeWatch instead.
   */
  async addReplay(
    userId: string,
    entryId: string,
    dto: AddMovieReplayDto,
  ): Promise<LibraryEntryDto> {
    const entry = await this.assertEntryOwnership(userId, entryId);
    const media = await this.prisma.mediaItem.findUniqueOrThrow({
      where: { id: entry.mediaItemId },
      select: { type: true },
    });

    if (media.type !== "MOVIE") {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryReplayNotMovie,
      );
    }

    await this.prisma.movieReplay.create({
      data: {
        libraryEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });

    await this.activity.emit({
      userId,
      type: ActivityType.REWATCHED,
      domain: "MEDIA",
      targetType: ReviewTargetType.MEDIA,
      targetId: entry.mediaItemId,
      homeFeed: true,
    });

    return this.getEntry(userId, entryId);
  }

  async deleteReplay(userId: string, replayId: string): Promise<void> {
    const replay = await this.prisma.movieReplay.findUnique({
      where: { id: replayId },
      include: { libraryEntry: true },
    });

    if (!replay) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryReplayNotFound,
      );
    }

    if (replay.libraryEntry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryReplayForbidden,
      );
    }

    await this.prisma.movieReplay.delete({ where: { id: replayId } });
  }

  /**
   * Unified media page (`/app/media/{type}/{id}`): metadata + the current user's
   * library state in one call. Served from the cache when the media is already
   * persisted, otherwise fetched live (persisting nothing — an unreferenced
   * media must not enter the on-demand cache just because it was previewed).
   */
  // `lang`: the signed-in user's locale, when known (live path only — a
  // cached item already has its stored, possibly stale, language).
  async getMediaDetail(
    userId: string,
    type: MediaType,
    sourceId: string,
    lang?: string,
  ): Promise<MediaDetailDto> {
    const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";

    const ref = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId_type: {
          source: source as DbExternalSource,
          externalId: sourceId,
          type,
        },
      },
      include: { mediaItem: true },
    });

    if (ref) {
      const detail = await this.mediaDetailFromCache(
        userId,
        source,
        sourceId,
        ref.mediaItem,
        type,
        lang,
      );
      const allowAdult = await this.ageGate.allowsAdultContent(userId);
      this.ageGate.assertAdultAllowed(detail.isAdult, allowAdult);
      return detail;
    }

    const details = await this.mediaItemService.getLiveDetails(
      source,
      sourceId,
      type,
      lang,
    );
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    this.ageGate.assertAdultAllowed(details.isAdult, allowAdult);
    return {
      source,
      sourceId,
      type,
      title: details.title,
      originalTitle: details.originalTitle ?? null,
      year: details.year,
      posterUrl: details.posterUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      genres: details.genres,
      airingStatus: details.status,
      airingFinished: normalizeAiringFinished(details.status),
      isAdult: details.isAdult,
      seasons: details.seasons.map((season) => ({
        id: null,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: null,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate,
          watchCount: 0,
          watches: [],
        })),
      })),
      entry: null,
    };
  }

  private async mediaDetailFromCache(
    userId: string,
    source: CatalogSource,
    sourceId: string,
    media: MediaItem,
    type: MediaType,
    lang: string | undefined,
  ): Promise<MediaDetailDto> {
    // Only fetched/created when `lang` isn't the base row's own (English)
    // language — see the note on MediaItemService.translationFor.
    const translation = lang
      ? await this.mediaItemService.translationFor(
          media.id,
          source,
          sourceId,
          type,
          lang,
        )
      : null;

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      orderBy: { number: "asc" },
      include: {
        episodes: {
          orderBy: { number: "asc" },
          include: {
            watches: {
              where: { userId },
              orderBy: { watchedAt: "desc" },
              select: { id: true, watchedAt: true },
            },
          },
        },
      },
    });

    const entryRow = await this.prisma.libraryEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      include: ENTRY_INCLUDE,
    });
    const entry = entryRow
      ? this.toEntryDto(
          entryRow,
          await this.computeProgress(userId, media.id),
          await this.lastWatchedAt(userId, media.id),
          await this.reviews.getRating(
            userId,
            ReviewTargetType.MEDIA,
            media.id,
          ),
        )
      : null;

    return {
      source,
      sourceId,
      type: media.type,
      title: translation?.title ?? media.title,
      // Original title is not persisted separately; only used for matching.
      originalTitle: null,
      year: media.releaseDate ? media.releaseDate.getFullYear() : null,
      posterUrl: media.posterUrl,
      backdropUrl: media.backdropUrl,
      overview: translation?.overview ?? media.overview,
      genres: translation?.genres ?? media.genres,
      airingStatus: media.status,
      airingFinished: normalizeAiringFinished(media.status),
      isAdult: media.isAdult,
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          watchCount: episode.watches.length,
          watches: episode.watches.map((w) => ({
            id: w.id,
            episodeId: episode.id,
            watchedAt: w.watchedAt.toISOString(),
          })),
        })),
      })),
      entry,
    };
  }
}

function toMediaItemDto(
  media: MediaItem & { externalIds: MediaExternalId[] },
  translatedTitle?: string,
): MediaItemDto {
  return {
    id: media.id,
    type: media.type,
    title: translatedTitle ?? media.title,
    posterUrl: media.posterUrl,
    canonicalSource: media.canonicalSource,
    sourceId: canonicalExternalId(media, media.externalIds),
  };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toReplayDto(replay: MovieReplay): MovieReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}
