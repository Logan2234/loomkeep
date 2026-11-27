import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  type BulkEntriesResultDto,
  type BulkEntriesTargetDto,
  isDormant,
  isGhost,
  type LibraryEntryDto,
  MEDIA_SORT_KEYS,
  MEDIA_SYNTHETIC_STATUS,
  type MediaSortKey,
  type PagedResult,
  type PileSummaryDto,
  RealtimeEvent,
  type TrackedMediaDto,
} from "@loomkeep/shared/contracts";
import {
  ActivityType,
  Domain,
  EntryStatus,
  MediaType,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared/enums";
import {
  episodesTimeLeft,
  isRuntimeKnown,
  runtimeFor,
} from "@loomkeep/shared/rules";
import { revokeEntryXp } from "../work/entry-lifecycle.util";

import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { toDateOrNull } from "../common/date.util";
import { canonicalExternalId } from "../common/external-id.util";
import { EventsGateway } from "../events/events.gateway";
import { AchievementService } from "../gamification/achievements/achievement.service";
import {
  addToList,
  applyBulkUpdate,
  applyToEntries,
  assertBulkTarget,
  assertBulkUpdate,
} from "../work/bulk-entries.util";
import type { EntryStatusChange } from "../work/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  deleteOwnedReplay,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  searchTerm,
} from "../work/entry-lifecycle.util";
import { MediaItemService } from "./media-item.service";
import { assertMediaReleased } from "./movie-release.util";

import { retryAfterUniqueRace } from "../common/prisma-error.util";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/triggers";
import { XpService } from "../gamification/xp.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { ActivityService } from "../social/activity.service";
import { summarizePile } from "../stats/pile.util";
import { AgeGateService } from "../users/age-gate.service";
import {
  loanUpdate,
  loanWhere,
  ownershipSourceUpdate,
} from "../work/entry-loan.util";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
import type { BulkUpdateEntriesBody } from "./dto/bulk-update-entries.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { deriveStatus, normalizeAiringFinished } from "./status.util";

import {
  compareMediaEntries,
  ENTRY_INCLUDE,
  ListEntriesFilters,
  materializedProgress,
  MEDIA_ROW_SELECT,
  MediaRow,
} from "./media-entries.util";
import { MediaEpisodesService } from "./media-episodes.service";
import { MediaProgressService } from "./media-progress.service";

/**
 * A user's media library: adding, listing, editing and deleting entries, the
 * pile, bulk edits and film replays. Episode watches are MediaEpisodesService's.
 */
@Injectable()
export class MediaLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
    private readonly events: EventsGateway,
    private readonly lists: ListService,
    private readonly progress: MediaProgressService,
    private readonly episodes: MediaEpisodesService,
  ) {}

  /** First touch of a media persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertEntryDto,
  ): Promise<LibraryEntryDto> {
    // AniList holds the anime, TMDB everything else: any other pair would
    // store an item under a type its source never gave it.
    if ((dto.source === "ANILIST") !== (dto.type === "ANIME")) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
      );
    }

    const mediaItem = await this.mediaItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
      dto.type,
    );

    if (mediaItem.isAdult) {
      const allowAdult = await this.ageGate.allowsAdultContent(userId);
      this.ageGate.assertAdultAllowed(true, allowAdult);
    }

    if (
      dto.status === "COMPLETED" ||
      (dto.rating !== null && dto.rating !== undefined)
    ) {
      await assertMediaReleased(this.prisma, mediaItem.id);
    }

    const before = await this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await retryAfterUniqueRace(() =>
      this.prisma.mediaEntry.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: mediaItem.id } },
        update: changes,
        create: { userId, mediaItemId: mediaItem.id, ...changes },
        include: ENTRY_INCLUDE,
      }),
    );

    entry.finishedAt = await this.progress.syncFinishedAt(
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

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.MEDIA,
        countEntries: () => this.prisma.mediaEntry.count({ where: { userId } }),
      });
    }

    if (
      mediaItem.type === "MOVIE" &&
      before?.status !== "COMPLETED" &&
      entry.status === "COMPLETED"
    ) {
      await this.xp.award(userId, XpReason.MOVIE_WATCHED, entry.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.MOVIE_WATCHED],
      );
      await this.progress.awardSagaIfCompleted(userId, entry.mediaItemId);
    }

    // The /10 rating lives in Review (the single source of truth).
    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
        dto.rating,
      );
    }

    // add_title/mark_complete are two of the onboarding checklist's steps
    // (see OnboardingService) — pushed unconditionally rather than checking
    // whether onboarding is even still in progress first, since that check
    // would cost as much as the emit is worth avoiding.
    this.events.emitToUser(userId, RealtimeEvent.ONBOARDING_UPDATED);

    return this.progress.toEntryDto(
      entry,
      await this.progress.computeProgress(
        userId,
        mediaItem.id,
        entry.rewatchStartedAt,
      ),
      await this.progress.lastWatchedAt(userId, mediaItem.id),
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MEDIA,
        mediaItem.id,
      ),
    );
  }

  /**
   * Media can't let Postgres pick the page: the status is derived from watch
   * progress, the default sort is the last viewing, and the search matches
   * the translated title. Every entry is ranked on a light row instead, from
   * the progress materialized on it — only the page gets the full progress
   * (next episode included) and the full DTO.
   */
  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<LibraryEntryDto>> {
    const { rows, keep } = this.filteredRows(userId, filters);

    return listEntryPage(filters, {
      sortKeys: MEDIA_SORT_KEYS,
      defaultSort: "recent",
      compare: compareMediaEntries,
      rows,
      keep,
      load: async (ids) => {
        const entries = await this.prisma.mediaEntry.findMany({
          where: { id: { in: ids } },
          include: ENTRY_INCLUDE,
        });
        const mediaItemIds = entries.map((e) => e.mediaItemId);
        const [ratings, progressByMedia, titles] = await Promise.all([
          this.reviews.getRatings(userId, ReviewTargetType.MEDIA, mediaItemIds),
          this.progress.computeProgressBatch(
            userId,
            mediaItemIds,
            new Map(
              entries.flatMap((e) =>
                e.rewatchStartedAt ? [[e.mediaItemId, e.rewatchStartedAt]] : [],
              ),
            ),
          ),
          this.titlesIn(mediaItemIds, filters.lang),
        ]);
        return entries.map((entry) => {
          const p = progressByMedia.get(entry.mediaItemId);
          return this.progress.toEntryDto(
            entry,
            p?.progress ?? null,
            p?.lastWatchedAt ?? null,
            ratings.get(entry.mediaItemId) ?? null,
            titles.get(entry.mediaItemId),
          );
        });
      },
    });
  }

  /**
   * What's left to watch among the entries the library list would show under
   * the same filters (UX-02): planned titles in full, plus the aired,
   * unwatched episodes of what's in progress. Specials (season 0) never
   * count, as for progress. A title with no known length falls back to the
   * per-type default, flagged as an estimate — same rule as the stats.
   */
  async getPile(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PileSummaryDto> {
    const { rows, keep } = this.filteredRows(userId, filters);
    const pileIds = (await rows("recent"))
      .filter(
        (row) =>
          keep(row) &&
          (row.status === EntryStatus.PLANNED ||
            row.status === EntryStatus.WATCHING),
      )
      .map((row) => row.id);
    const entries = await this.prisma.mediaEntry.findMany({
      where: { id: { in: pileIds } },
      select: {
        mediaItemId: true,
        mediaItem: { select: { type: true, runtimeMin: true } },
      },
    });
    const now = new Date();
    const episodes = await this.prisma.episode.findMany({
      where: {
        season: {
          number: { not: 0 },
          mediaItemId: {
            in: entries
              .filter((e) => e.mediaItem.type !== MediaType.MOVIE)
              .map((e) => e.mediaItemId),
          },
        },
        OR: [{ airDate: null }, { airDate: { lte: now } }],
        watches: { none: { userId } },
      },
      select: { runtimeMin: true, season: { select: { mediaItemId: true } } },
    });
    const episodesByMedia = new Map<string, typeof episodes>();

    for (const episode of episodes) {
      const id = episode.season.mediaItemId;
      const group = episodesByMedia.get(id);
      if (group) group.push(episode);
      else episodesByMedia.set(id, [episode]);
    }

    return summarizePile(
      "MINUTES",
      entries.map(({ mediaItemId, mediaItem }) => {
        if (mediaItem.type === MediaType.MOVIE) {
          return {
            amount: runtimeFor(mediaItem.type, mediaItem.runtimeMin),
            estimated: !isRuntimeKnown(null, mediaItem.runtimeMin),
          };
        }

        const left = episodesByMedia.get(mediaItemId) ?? [];
        const remaining = episodesTimeLeft(
          mediaItem.type,
          mediaItem.runtimeMin,
          left,
        );
        return {
          amount: remaining.minutes,
          estimated: remaining.estimated,
        };
      }),
    );
  }

  /**
   * Applies one change to every targeted entry, each through updateEntry
   * (or the list's addItem), so the side effects match a single update's.
   */
  async bulkUpdate(
    userId: string,
    dto: BulkUpdateEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    assertBulkUpdate(dto);
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId, id: { in: await this.bulkTargetIds(userId, dto) } },
      orderBy: RECENTLY_UPDATED_FIRST,
      select: {
        id: true,
        mediaItemId: true,
        status: true,
        favorite: true,
        ownershipStatus: true,
        ownershipSource: true,
        mediaItem: { select: { type: true } },
      },
    });
    const types = new Map(entries.map((e) => [e.id, e.mediaItem.type]));

    return applyBulkUpdate(
      entries.map((e) => ({
        id: e.id,
        itemId: e.mediaItemId,
        status: e.status,
        favorite: e.favorite,
        ownershipStatus: e.ownershipStatus,
        ownershipSource: e.ownershipSource,
      })),
      dto,
      {
        update: (id, patch) =>
          this.updateEntry(userId, id, patch as UpdateEntryDto),
        addToList: (itemId, listId) =>
          addToList(this.lists, userId, listId, "MEDIA", itemId),
        setStatus: async (entry, status) => {
          // A series is complete once its episodes are watched: every aired
          // one gets marked, as the season buttons do, and the status follows.
          if (
            status === EntryStatus.COMPLETED &&
            types.get(entry.id) !== MediaType.MOVIE
          ) {
            if (entry.status === EntryStatus.UP_TO_DATE) return false;
            return this.episodes.watchAllAired(
              userId,
              entry.itemId,
              types.get(entry.id) as MediaType,
            );
          }

          await this.updateEntry(userId, entry.id, {
            status,
          } as UpdateEntryDto);
          return true;
        },
      },
    );
  }

  /** Removes every targeted entry, each through deleteEntry. */
  async bulkDelete(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Promise<BulkEntriesResultDto> {
    assertBulkTarget(target);
    return applyToEntries(
      await this.bulkTargetIds(userId, target),
      async (id) => {
        await this.deleteEntry(userId, id);
        return true;
      },
    );
  }

  /** The user's own picks, or every entry the list shows under the filters. */
  private async bulkTargetIds(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Promise<string[]> {
    if (!target.filters) {
      const owned = await this.prisma.mediaEntry.findMany({
        where: { userId, id: { in: target.ids ?? [] } },
        select: { id: true },
      });
      return owned.map((e) => e.id);
    }

    const { rows, keep } = this.filteredRows(userId, target.filters);
    return (await rows("recent")).filter(keep).map((row) => row.id);
  }

  /**
   * Media can't let Postgres filter everything: the status is derived from
   * watch progress and the search matches the translated title. Every entry
   * is read as a light row, its progress counted in SQL, then `keep` applies
   * what SQL couldn't — shared by the list and the pile so the header's
   * figure always covers exactly what the list shows.
   */
  private filteredRows(userId: string, filters: ListEntriesFilters) {
    const q = searchTerm(filters)?.toLowerCase();
    const where: Prisma.MediaEntryWhereInput = {
      userId,
      favorite: filters.favorite ? true : undefined,
      ...loanWhere(filters.loan),
      mediaItem:
        filters.types && filters.types.length > 0
          ? { type: { in: filters.types } }
          : undefined,
    };
    const statuses = filters.statuses ?? [];

    const rows = async (sort: MediaSortKey): Promise<MediaRow[]> => {
      const entries = await this.prisma.mediaEntry.findMany({
        where,
        orderBy: RECENTLY_UPDATED_FIRST,
        select: MEDIA_ROW_SELECT,
      });
      const ids = entries.map((e) => e.mediaItemId);
      const [ratings, titles] = await Promise.all([
        sort === "rating"
          ? this.reviews.getRatings(userId, ReviewTargetType.MEDIA, ids)
          : new Map<string, number>(),
        q || sort === "title"
          ? this.titlesIn(ids, filters.lang)
          : new Map<string, string>(),
      ]);

      return entries.map((entry) => {
        const progress = materializedProgress(entry);
        // Same fallback as toEntryDto: a movie has no episode watches.
        const lastWatchedAt = entry.lastWatchedAt ?? entry.finishedAt;
        return {
          id: entry.id,
          status: deriveStatus(
            entry.mediaItem.type,
            progress,
            normalizeAiringFinished(entry.mediaItem.status),
            entry.status,
            !!entry.rewatchStartedAt,
          ),
          rating: ratings.get(entry.mediaItemId) ?? null,
          startedAt: entry.startedAt?.toISOString() ?? null,
          finishedAt: entry.finishedAt?.toISOString() ?? null,
          createdAt: entry.createdAt.toISOString(),
          lastWatchedAt: lastWatchedAt?.toISOString() ?? null,
          mediaItem: {
            title: titles.get(entry.mediaItemId) ?? entry.mediaItem.title,
          },
          progress,
        };
      });
    };

    // "DORMANT" and "GHOST" are synthetic refinements of WATCHING.
    const matches = (row: MediaRow, s: string) =>
      s === MEDIA_SYNTHETIC_STATUS.DORMANT
        ? isDormant(row)
        : s === MEDIA_SYNTHETIC_STATUS.GHOST
          ? isGhost(row)
          : row.status === s;
    const keep = (row: MediaRow) =>
      (statuses.length === 0 || statuses.some((s) => matches(row, s))) &&
      (!q || row.mediaItem.title.toLowerCase().includes(q));

    return { rows, keep };
  }

  private titlesIn(
    mediaItemIds: string[],
    lang: string | undefined,
  ): Promise<Map<string, string>> {
    return lang
      ? this.mediaItemService.translatedTitles(mediaItemIds, lang)
      : Promise.resolve(new Map<string, string>());
  }

  async getEntry(userId: string, entryId: string): Promise<LibraryEntryDto> {
    const entry = await assertEntryOwnership(userId, () =>
      this.prisma.mediaEntry.findUnique({
        where: { id: entryId },
        include: ENTRY_INCLUDE,
      }),
    );
    return this.progress.toEntryDto(
      entry,
      await this.progress.computeProgress(
        userId,
        entry.mediaItemId,
        entry.rewatchStartedAt,
      ),
      await this.progress.lastWatchedAt(userId, entry.mediaItemId),
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
    acceptLanguage?: string,
  ): Promise<LibraryEntryDto> {
    const owned = await this.progress.assertEntryOwnership(userId, entryId);

    if (
      dto.status === "COMPLETED" ||
      (dto.rating !== null && dto.rating !== undefined) ||
      (dto.startedAt !== null && dto.startedAt !== undefined) ||
      (dto.finishedAt !== null && dto.finishedAt !== undefined)
    ) {
      await assertMediaReleased(this.prisma, owned.mediaItemId);
    }

    let reminder: {
      movieReleaseReminderAt?: Date | null;
      movieReleaseRegion?: string | null;
    } = {};

    if (dto.movieReleaseAlertsEnabled !== undefined) {
      const region = await this.progress.movieRegion(userId, acceptLanguage);
      reminder = {
        movieReleaseReminderAt: dto.movieReleaseAlertsEnabled
          ? (owned.movieReleaseReminderAt ?? new Date())
          : null,
        movieReleaseRegion: dto.movieReleaseAlertsEnabled ? region : null,
      };
    }

    const before = owned;

    const entry = await this.prisma.mediaEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        ...reminder,
        notes: dto.notes,
        favorite: dto.favorite,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: ownershipSourceUpdate(owned.ownershipStatus, dto),
        ...loanUpdate(owned, dto),
        episodeAlertsMuted: dto.episodeAlertsMuted,
        rewatchStartedAt: await this.progress.rewatchStartedAtFor(
          userId,
          owned,
          dto.rewatching,
        ),
      },
      include: ENTRY_INCLUDE,
    });

    // Only auto-derive when the caller didn't explicitly set finishedAt
    // themselves (e.g. a future manual-date editor).
    if (dto.finishedAt === undefined) {
      entry.finishedAt = await this.progress.syncFinishedAt(
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

    if (
      entry.mediaItem.type === "MOVIE" &&
      before?.status !== "COMPLETED" &&
      entry.status === "COMPLETED"
    ) {
      await this.xp.award(userId, XpReason.MOVIE_WATCHED, entry.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.MOVIE_WATCHED],
      );
      await this.progress.awardSagaIfCompleted(userId, entry.mediaItemId);
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
        dto.rating,
      );
    }

    this.events.emitToUser(userId, RealtimeEvent.ONBOARDING_UPDATED);

    return this.progress.toEntryDto(
      entry,
      await this.progress.computeProgress(
        userId,
        entry.mediaItemId,
        entry.rewatchStartedAt,
      ),
      await this.progress.lastWatchedAt(userId, entry.mediaItemId),
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
    const entry = await this.progress.assertEntryOwnership(userId, entryId);

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
    // with once the watches are gone. XP writes never
    // happen inside a $transaction (no side effect in the lock, same as
    // `activity.emit` elsewhere in this file, always awaited after one).
    const watches = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodeIds } },
      select: { id: true },
    });
    // Same reason: the transaction below deletes these Reviews outright
    // (not via ReviewService.setRating/remove, which handle their own XP
    // revocation) — WORK_RATED/REVIEW_WRITTEN/REVIEW_DETAILED would
    // otherwise linger until the next nightly reconciliation.
    const reviews = await this.prisma.review.findMany({
      where: { userId, targetId: { in: targetIds } },
      select: { id: true },
    });
    // Same again for a movie's rewatches: they cascade with the entry, and
    // MOVIE_REPLAYED is anchored to each one, not to the entry.
    const replays = await this.prisma.movieReplay.findMany({
      where: { mediaEntryId: entryId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: { userId, episodeId: { in: episodeIds } },
      }),
      ...polymorphicTargetCleanup(
        this.prisma,
        userId,
        [
          ReviewTargetType.MEDIA,
          ReviewTargetType.SEASON,
          ReviewTargetType.EPISODE,
        ],
        targetIds,
      ),
      this.prisma.mediaEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource(
      userId,
      "EpisodeWatch",
      watches.map((w) => w.id),
    );
    // Cleans MOVIE_WATCHED and SERIES_COMPLETED (both sourceType
    // "MediaEntry") in one call — intentional: deleting a whole entry
    // must wipe every reason anchored to it, unlike unwatching a single
    // season/episode, which only ever revokes its own reason.
    await this.xp.revokeBySource(userId, "MediaEntry", [entryId]);
    await revokeEntryXp(this.xp, userId, [
      { sourceType: "Entry", ids: [entryId] },
      { sourceType: "Season", ids: seasons.map((s) => s.id) },
      { sourceType: "MovieReplay", ids: replays.map((r) => r.id) },
      { sourceType: "Review", ids: reviews.map((r) => r.id) },
    ]);
  }

  /** Emits the status milestone + FAVORITED events for a media entry write. */
  private emitEntryActivity(
    userId: string,
    mediaItemId: string,
    change: EntryStatusChange,
  ): Promise<void> {
    return emitEntryActivity(
      this.activity,
      {
        userId,
        domain: Domain.MEDIA,
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
      },
      change,
    );
  }

  /**
   * Every work the user tracks, with its effective status — the same
   * derivation as the library list, from the materialized progress of each
   * entry. See MediaLibraryController.listTracked.
   */
  async trackedStatuses(userId: string): Promise<TrackedMediaDto[]> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId },
      select: {
        status: true,
        watchedEpisodes: true,
        rewatchStartedAt: true,
        mediaItem: {
          select: {
            type: true,
            status: true,
            episodeCount: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    return entries.flatMap((entry) => {
      const { mediaItem } = entry;
      const sourceId = canonicalExternalId(mediaItem, mediaItem.externalIds);
      if (!sourceId) return [];
      return [
        {
          type: mediaItem.type as MediaType,
          sourceId,
          status: deriveStatus(
            mediaItem.type,
            materializedProgress(entry),
            normalizeAiringFinished(mediaItem.status),
            entry.status,
            !!entry.rewatchStartedAt,
          ),
        },
      ];
    });
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
    const entry = await this.progress.assertEntryOwnership(userId, entryId);
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

    await assertMediaReleased(this.prisma, entry.mediaItemId);

    const replay = await this.prisma.movieReplay.create({
      data: {
        mediaEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });
    await this.xp.award(userId, XpReason.MOVIE_REPLAYED, replay.id);

    if (entry.rewatchStartedAt) {
      await this.prisma.mediaEntry.update({
        where: { id: entryId },
        data: { rewatchStartedAt: null },
      });
    }

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
    await deleteOwnedReplay(this.xp, {
      userId,
      replayId,
      xpSource: "MovieReplay",
      findOwnerId: async () =>
        (
          await this.prisma.movieReplay.findUnique({
            where: { id: replayId },
            select: { mediaEntry: { select: { userId: true } } },
          })
        )?.mediaEntry.userId ?? null,
      remove: () => this.prisma.movieReplay.delete({ where: { id: replayId } }),
    });
  }
}
