import type {
  BulkEntriesResultDto,
  BulkEntriesTargetDto,
  CalendarEntryDto,
  CatalogSource,
  EntryEpisodesResponseDto,
  EpisodeWatchDto,
  LibraryDomainCountsDto,
  LibraryEntryDto,
  MediaDetailDto,
  MediaItemDto,
  MovieReplayDto,
  PagedResult,
  PileSummaryDto,
  ProgressDto,
} from "@loomkeep/shared";
import {
  ActivityType,
  Domain,
  EntryStatus,
  episodeRuntimeFor,
  ErrorCode,
  isAnimeUnaired,
  isDormant,
  isGhost,
  isRuntimeKnown,
  MediaType,
  movieReleaseDates,
  movieReleaseInfo,
  ReviewTargetType,
  runtimeFor,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  ExternalSource as DbExternalSource,
  MediaExternalId,
  MediaItem,
  MovieReplay,
  Prisma,
} from "@prisma/client";
import { MediaItemService } from "../catalog/media-item.service";
import { assertMediaReleased } from "../catalog/movie-release.util";
import { resolveWatchRegion } from "../catalog/watch-region.util";
import { AppException } from "../common/app.exception";
import {
  addToList,
  applyBulkUpdate,
  applyToEntries,
  assertBulkTarget,
  assertBulkUpdate,
} from "../common/bulk-entries.util";
import { toDateOrNull } from "../common/date.util";
import type {
  EntryStatusChange,
  ListEntriesFilters as SharedListEntriesFilters,
} from "../common/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  deleteOwnedReplay,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  searchTerm,
} from "../common/entry-lifecycle.util";
import { canonicalExternalId } from "../common/external-id.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { toGameItemDto } from "../games/game-item.mapper";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
import {
  isSeasonComplete,
  isSeriesComplete,
} from "../gamification/xp-verifiers";
import { XpService } from "../gamification/xp.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { ActivityService } from "../social/activity.service";
import { summarizePile } from "../stats/pile.util";
import { AgeGateService } from "../users/age-gate.service";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
import type { BulkUpdateEntriesBody } from "./dto/bulk-update-entries.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
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

type MediaSortKey =
  | "recent"
  | "added"
  | "title"
  | "rating"
  | "progress"
  | "finished"
  | "started"
  | "status";
const MEDIA_SORT_KEYS = [
  "recent",
  "added",
  "title",
  "rating",
  "progress",
  "finished",
  "started",
  "status",
] as const satisfies readonly MediaSortKey[];
// Order used by the "Statut" sort.
const MEDIA_STATUS_SORT_ORDER: EntryStatus[] = [
  "WATCHING",
  "PLANNED",
  "UP_TO_DATE",
  "COMPLETED",
  "DROPPED",
];

/**
 * `statuses` accepts "DORMANT" and "GHOST" alongside real `EntryStatus`
 * values — see `isDormant` and `isGhost`. `lang` drives
 * `MediaItemService.translatedTitles` here, on top of the collation it drives
 * everywhere.
 */
export interface ListEntriesFilters extends SharedListEntriesFilters {
  types?: MediaType[];
}

/** What ranking and filtering a media entry read — a light slice of its DTO. */
type MediaRow = Pick<
  LibraryEntryDto,
  | "id"
  | "status"
  | "rating"
  | "startedAt"
  | "finishedAt"
  | "createdAt"
  | "lastWatchedAt"
> & {
  mediaItem: Pick<MediaItemDto, "title">;
  progress: Pick<ProgressDto, "watchedEpisodes" | "totalEpisodes"> | null;
};

const MEDIA_ROW_SELECT = {
  id: true,
  mediaItemId: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  mediaItem: { select: { type: true, status: true, title: true } },
} satisfies Prisma.LibraryEntrySelect;

function mediaProgressPct(entry: MediaRow): number {
  if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
  return Math.round(
    (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
  );
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareMediaEntries(
  sort: MediaSortKey,
  a: MediaRow,
  b: MediaRow,
  locale: string | undefined,
): number {
  switch (sort) {
    case "title":
      return compareTitles(a.mediaItem.title, b.mediaItem.title, locale);
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
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
    private readonly events: EventsGateway,
    private readonly lists: ListService,
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

    if (
      dto.status === "COMPLETED" ||
      (dto.rating !== null && dto.rating !== undefined)
    ) {
      await assertMediaReleased(this.prisma, mediaItem.id);
    }

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

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.MEDIA,
        countEntries: () =>
          this.prisma.libraryEntry.count({ where: { userId } }),
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
    this.events.emitToUser(userId, "onboarding-updated");

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

  /**
   * Tracked-item count per domain, hidden domains included. Deliberately not
   * routed through the stats endpoints: those are scoped to the user's
   * `enabledDomains`, and the settings tiles need to say what switching a
   * domain *off* would hide. PODCASTS/BOARDGAMES have no table yet, so they
   * are absent rather than zero.
   */
  async getDomainCounts(userId: string): Promise<LibraryDomainCountsDto> {
    const [media, games, books, music] = await Promise.all([
      this.prisma.libraryEntry.count({ where: { userId } }),
      this.prisma.gameEntry.count({ where: { userId } }),
      this.prisma.bookEntry.count({ where: { userId } }),
      this.prisma.musicEntry.count({ where: { userId } }),
    ]);

    return {
      [Domain.MEDIA]: media,
      [Domain.GAMES]: games,
      [Domain.BOOKS]: books,
      [Domain.MUSIC]: music,
    };
  }

  /**
   * Media can't let Postgres pick the page: the status is derived from watch
   * progress, the default sort is the last viewing, and the search matches
   * the translated title. Every entry is ranked on a light row instead, its
   * progress counted in SQL — only the page gets the full progress (next
   * episode included) and the full DTO.
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
        const entries = await this.prisma.libraryEntry.findMany({
          where: { id: { in: ids } },
          include: ENTRY_INCLUDE,
        });
        const mediaItemIds = entries.map((e) => e.mediaItemId);
        const [ratings, progressByMedia, titles] = await Promise.all([
          this.reviews.getRatings(userId, ReviewTargetType.MEDIA, mediaItemIds),
          this.computeProgressBatch(userId, mediaItemIds),
          this.titlesIn(mediaItemIds, filters.lang),
        ]);
        return entries.map((entry) => {
          const p = progressByMedia.get(entry.mediaItemId);
          return this.toEntryDto(
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
    const entries = await this.prisma.libraryEntry.findMany({
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
      episodesByMedia.set(id, [...(episodesByMedia.get(id) ?? []), episode]);
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
        return {
          amount: left.reduce(
            (sum, e) =>
              sum +
              episodeRuntimeFor(
                mediaItem.type,
                e.runtimeMin,
                mediaItem.runtimeMin,
              ),
            0,
          ),
          estimated: left.some(
            (e) => !isRuntimeKnown(e.runtimeMin, mediaItem.runtimeMin),
          ),
        };
      }),
    );
  }

  /**
   * Media can't let Postgres filter everything: the status is derived from
   * watch progress and the search matches the translated title. Every entry
   * is read as a light row, its progress counted in SQL, then `keep` applies
   * what SQL couldn't — shared by the list and the pile so the header's
   * figure always covers exactly what the list shows.
   */
  /**
   * Applies one change to every targeted entry, each through updateEntry
   * (or the list's addItem), so the side effects match a single update's.
   */
  async bulkUpdate(
    userId: string,
    dto: BulkUpdateEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    assertBulkUpdate(dto);
    const entries = await this.prisma.libraryEntry.findMany({
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
        addToList: (itemId) =>
          addToList(this.lists, userId, dto.listId!, "MEDIA", itemId),
        setStatus: async (entry, status) => {
          // A series is complete once its episodes are watched: every aired
          // one gets marked, as the season buttons do, and the status follows.
          if (
            status === EntryStatus.COMPLETED &&
            types.get(entry.id) !== MediaType.MOVIE
          ) {
            if (entry.status === EntryStatus.UP_TO_DATE) return false;
            return this.watchAllAired(userId, entry.itemId);
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
      const owned = await this.prisma.libraryEntry.findMany({
        where: { userId, id: { in: target.ids ?? [] } },
        select: { id: true },
      });
      return owned.map((e) => e.id);
    }

    const { rows, keep } = this.filteredRows(userId, target.filters);
    return (await rows("recent")).filter(keep).map((row) => row.id);
  }

  /** Every aired episode of every regular season watched (specials never count, as for progress). */
  private async watchAllAired(
    userId: string,
    mediaItemId: string,
  ): Promise<boolean> {
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId, number: { not: 0 }, episodes: { some: {} } },
      orderBy: { number: "asc" },
      select: { id: true },
    });

    for (const season of seasons) {
      await this.watchSeason(userId, season.id);
    }

    return seasons.length > 0;
  }

  private filteredRows(userId: string, filters: ListEntriesFilters) {
    const q = searchTerm(filters)?.toLowerCase();
    const where: Prisma.LibraryEntryWhereInput = {
      userId,
      favorite: filters.favorite ? true : undefined,
      mediaItem:
        filters.types && filters.types.length > 0
          ? { type: { in: filters.types } }
          : undefined,
    };
    const statuses = filters.statuses ?? [];

    const rows = async (sort: MediaSortKey): Promise<MediaRow[]> => {
      const entries = await this.prisma.libraryEntry.findMany({
        where,
        orderBy: RECENTLY_UPDATED_FIRST,
        select: MEDIA_ROW_SELECT,
      });
      const ids = entries.map((e) => e.mediaItemId);
      const [counts, ratings, titles] = await Promise.all([
        this.progressCounts(userId, ids),
        sort === "rating"
          ? this.reviews.getRatings(userId, ReviewTargetType.MEDIA, ids)
          : new Map<string, number>(),
        q || sort === "title"
          ? this.titlesIn(ids, filters.lang)
          : new Map<string, string>(),
      ]);

      return entries.map((entry) => {
        const count = counts.get(entry.mediaItemId);
        const progress =
          count && count.total > 0
            ? {
                watchedEpisodes: count.watched,
                totalEpisodes: count.total,
                nextEpisode: null,
              }
            : null;
        // Same fallback as toEntryDto: a movie has no episode watches.
        const lastWatchedAt = count?.lastWatchedAt ?? entry.finishedAt;
        return {
          id: entry.id,
          status: deriveStatus(
            entry.mediaItem.type,
            progress,
            normalizeAiringFinished(entry.mediaItem.status),
            entry.status,
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
      s === "DORMANT"
        ? isDormant(row)
        : s === "GHOST"
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
    acceptLanguage?: string,
  ): Promise<LibraryEntryDto> {
    const owned = await this.assertEntryOwnership(userId, entryId);

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
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { watchRegion: true },
      });
      reminder = {
        movieReleaseReminderAt: dto.movieReleaseAlertsEnabled
          ? (owned.movieReleaseReminderAt ?? new Date())
          : null,
        movieReleaseRegion: dto.movieReleaseAlertsEnabled
          ? resolveWatchRegion(user.watchRegion ?? undefined, acceptLanguage)
          : null,
      };
    }

    const before = await this.prisma.libraryEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true },
    });

    const entry = await this.prisma.libraryEntry.update({
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
        ownershipSource: dto.ownershipSource,
        episodeAlertsMuted: dto.episodeAlertsMuted,
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
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        entry.mediaItemId,
        dto.rating,
      );
    }

    this.events.emitToUser(userId, "onboarding-updated");

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

    await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: { userId, episodeId: { in: episodeIds } },
      }),
      ...polymorphicTargetCleanup(this.prisma, userId, targetIds),
      this.prisma.libraryEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource(
      "EpisodeWatch",
      watches.map((w) => w.id),
    );
    // Cleans MOVIE_WATCHED and SERIES_COMPLETED (both sourceType
    // "LibraryEntry") in one call — intentional: deleting a whole entry
    // must wipe every reason anchored to it, unlike unwatching a single
    // season/episode, which only ever revokes its own reason.
    await this.xp.revokeBySource("LibraryEntry", [entryId]);
    await this.xp.revokeBySource("Entry", [entryId]); // WORK_ADDED
    await this.xp.revokeBySource(
      "Season",
      seasons.map((s) => s.id),
    );
    await this.xp.revokeBySource(
      "Review",
      reviews.map((r) => r.id),
    ); // WORK_RATED / REVIEW_WRITTEN / REVIEW_DETAILED
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

  /**
   * Emits the SEASON_FINISHED milestone for every season, among the ones
   * touched by `affectedEpisodeIds`, that has just become fully watched and
   * wasn't before this action — distinct from the work-level FINISHED
   * (`syncFinishedAt`), so a feed can tell "finished season 3" from
   * "finished the whole show". Season 0 (TMDB specials) is excluded,
   * matching `computeProgress`'s own exclusion.
   *
   * `previouslyWatchedIds` must cover every episode of every season
   * `affectedEpisodeIds` might touch (not just the acted-upon ones) — a
   * partial set would under-count an already-complete season as "newly"
   * finished.
   */
  private async emitSeasonFinishedMilestones(
    userId: string,
    mediaItemId: string,
    affectedEpisodeIds: string[],
    previouslyWatchedIds: Set<string>,
  ): Promise<void> {
    if (affectedEpisodeIds.length === 0) return;

    const rawSeasons = await this.prisma.season.findMany({
      where: {
        mediaItemId,
        number: { gt: 0 },
        episodes: { some: { id: { in: affectedEpisodeIds } } },
      },
      select: { number: true, episodes: { select: { id: true } } },
    });
    // `?? []` tolerates a caller-narrowed select that doesn't happen to
    // include `episodes` — never the case for this query's own shape above,
    // but keeps this from throwing on a shared-mock testing setup.
    const seasons = rawSeasons.map((s) => ({
      number: s.number,
      episodes: s.episodes ?? [],
    }));
    if (seasons.length === 0) return;

    const nowWatched = await this.prisma.episodeWatch.findMany({
      where: {
        userId,
        episodeId: { in: seasons.flatMap((s) => s.episodes.map((e) => e.id)) },
      },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const nowWatchedIds = new Set(nowWatched.map((w) => w.episodeId));

    for (const season of seasons) {
      if (season.episodes.length === 0) continue;

      const wasComplete = season.episodes.every((e) =>
        previouslyWatchedIds.has(e.id),
      );
      if (wasComplete) continue; // already emitted on an earlier watch

      const isComplete = season.episodes.every((e) => nowWatchedIds.has(e.id));
      if (!isComplete) continue;

      await this.activity.emit({
        userId,
        type: ActivityType.SEASON_FINISHED,
        domain: Domain.MEDIA,
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        level: "SEASON",
        data: { seasonNumber: season.number },
        homeFeed: true,
      });
    }
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

    await this.assertMediaOwnership(userId, episode.season.mediaItemId);

    if (episode.airDate && episode.airDate > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    const previouslyWatched = await this.prisma.episodeWatch.findMany({
      where: { userId, episode: { seasonId: episode.seasonId } },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const previouslyWatchedIds = new Set(
      previouslyWatched.map((w) => w.episodeId),
    );

    const watch = await this.prisma.episodeWatch.create({
      data: {
        userId,
        episodeId,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : undefined,
      },
    });

    await this.xp.award(userId, XpReason.EPISODE_WATCHED, watch.id);
    await this.achievements.evaluate(
      userId,
      ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.EPISODE_WATCHED],
    );
    await this.syncSeasonAndSeriesXp(userId, [episode.seasonId]);

    await this.syncFinishedAt(
      userId,
      episode.season.mediaItemId,
      episode.season.mediaItem.type,
    );

    await this.emitSeasonFinishedMilestones(
      userId,
      episode.season.mediaItemId,
      [episodeId],
      previouslyWatchedIds,
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
      watchedAt: watch.watchedAt?.toISOString() ?? null,
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

    await this.assertMediaOwnership(userId, season.mediaItemId);

    const previouslyWatched = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
      distinct: ["episodeId"],
      select: { episodeId: true },
    });
    const previouslyWatchedIds = new Set(
      previouslyWatched.map((w) => w.episodeId),
    );

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
    await this.emitSeasonFinishedMilestones(
      userId,
      season.mediaItemId,
      episodes.map((e) => e.id),
      previouslyWatchedIds,
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

    await this.assertMediaOwnership(userId, season.mediaItemId);

    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true },
    });

    // Loaded before the deleteMany so revokeBySource still has the ids to
    // work with afterwards. Never award/revoke inside a
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
    await this.syncSeasonAndSeriesXp(userId, [seasonId]);
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

    await this.assertMediaOwnership(userId, target.season.mediaItemId);

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

      // Scoped to every regular episode of the series (not just `throughIds`)
      // so a season that was already fully watched before this call — but
      // only partially covered by `throughIds` (the target's own season) —
      // isn't under-counted as "newly" finished below.
      const previouslyWatched = await this.prisma.episodeWatch.findMany({
        where: { userId, episodeId: { in: episodes.map((e) => e.id) } },
        distinct: ["episodeId"],
        select: { episodeId: true },
      });
      const previouslyWatchedIds = new Set(
        previouslyWatched.map((w) => w.episodeId),
      );

      await this.markUnwatched(userId, throughIds);
      await this.emitSeasonFinishedMilestones(
        userId,
        target.season.mediaItemId,
        throughIds,
        previouslyWatchedIds,
      );
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

      // Grouped by season, not per-episode, so a whole-season/whole-series
      // mark-through only checks completion once per season involved.
      const touchedSeasons = await this.prisma.episode.findMany({
        where: { id: { in: newEpisodeIds } },
        distinct: ["seasonId"],
        select: { seasonId: true },
      });
      await this.syncSeasonAndSeriesXp(
        userId,
        touchedSeasons.map((e) => e.seasonId),
      );
    }
  }

  /**
   * Re-derives SEASON_COMPLETED/SERIES_COMPLETED after a watch change
   * touching `seasonIds`, awarding or revoking each as needed. Reuses
   * `isSeasonComplete`/`isSeriesComplete` from xp-verifiers.ts — the same
   * completion rule the nightly reconciliation checks — so this live path
   * and that sweep can never disagree. Called once per batch of episodes
   * touched (never per individual episode), grouped by the distinct
   * seasons/series involved.
   */
  private async syncSeasonAndSeriesXp(
    userId: string,
    seasonIds: string[],
  ): Promise<void> {
    const uniqueSeasonIds = [...new Set(seasonIds)];
    if (uniqueSeasonIds.length === 0) return;

    const seasons = await this.prisma.season.findMany({
      where: { id: { in: uniqueSeasonIds } },
      select: { id: true, mediaItemId: true },
    });

    for (const season of seasons) {
      const complete = await isSeasonComplete(this.prisma, userId, season.id);

      if (complete) {
        await this.xp.award(userId, XpReason.SEASON_COMPLETED, season.id);
      } else {
        await this.xp.revokeBySource("Season", [season.id]);
      }
    }

    const mediaItemIds = [...new Set(seasons.map((s) => s.mediaItemId))];
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId, mediaItemId: { in: mediaItemIds } },
      select: { id: true },
    });

    for (const entry of entries) {
      const complete = await isSeriesComplete(this.prisma, userId, entry.id);

      if (complete) {
        await this.xp.award(userId, XpReason.SERIES_COMPLETED, entry.id);
        await this.achievements.evaluate(
          userId,
          ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.SERIES_COMPLETED],
        );
      } else {
        await this.xp.revokeBySource("LibraryEntry", [entry.id]);
      }
    }
  }

  /**
   * Upcoming local movie releases and episodes (air date today or later) of the series/anime the user
   * tracks, excluding dropped ones — the release calendar. Shows with muted
   * alerts stay listed: muting only silences the digest. Each carries the
   * show's backlog (`episodesBehind`), counted up to the start of today so
   * an episode airing today is never its own backlog.
   */
  async getCalendar(
    userId: string,
    acceptLanguage?: string,
  ): Promise<CalendarEntryDto[]> {
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
          include: {
            mediaItem: {
              include: {
                externalIds: true,
                // Unique per (userId, mediaItemId), and guaranteed to exist
                // by the `where` above — this is the user's tracked entry.
                entries: {
                  where: { userId },
                  select: { id: true, episodeAlertsMuted: true },
                },
              },
            },
          },
        },
      },
    });

    const behind = await this.episodesBehind(
      userId,
      [...new Set(episodes.map((e) => e.season.mediaItemId))],
      startOfToday,
    );

    const episodeEntries: CalendarEntryDto[] = episodes.map((episode) => ({
      mediaItem: toMediaItemDto(episode.season.mediaItem),
      game: null,
      entryId: episode.season.mediaItem.entries[0].id,
      episodeAlertsMuted:
        episode.season.mediaItem.entries[0].episodeAlertsMuted,
      episodesBehind: behind.get(episode.season.mediaItemId) ?? 0,
      seasonNumber: episode.season.number,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      // airDate is guaranteed non-null by the `gte` filter above.
      airDate: episode.airDate!.toISOString(),
    }));
    const movies = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        status: { not: "DROPPED" },
        mediaItem: { type: "MOVIE" },
      },
      include: { mediaItem: { include: { externalIds: true } } },
    });
    const gameEntries = await this.calendarGames(userId);
    if (movies.length === 0)
      return [...episodeEntries, ...gameEntries].sort((a, b) =>
        a.airDate.localeCompare(b.airDate),
      );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { watchRegion: true },
    });
    const today = new Date().toISOString().slice(0, 10);
    const movieEntries: CalendarEntryDto[] = movies.flatMap((entry) => {
      const region = resolveWatchRegion(
        user.watchRegion ?? entry.movieReleaseRegion ?? undefined,
        acceptLanguage,
      );
      const release = movieReleaseInfo(
        movieReleaseDates(entry.mediaItem.movieReleaseDates),
        entry.mediaItem.status,
        region,
      );
      if (!release.localDate || release.localDate < today || !release.localType)
        return [];
      return [
        {
          mediaItem: toMediaItemDto(entry.mediaItem),
          game: null,
          entryId: entry.id,
          episodeAlertsMuted: !entry.movieReleaseReminderAt,
          episodesBehind: 0,
          seasonNumber: null,
          episodeNumber: null,
          episodeTitle: null,
          airDate: `${release.localDate}T00:00:00.000Z`,
          releaseRegion: region,
          releaseType: release.localType,
        },
      ];
    });
    return [...episodeEntries, ...movieEntries, ...gameEntries].sort((a, b) =>
      a.airDate.localeCompare(b.airDate),
    );
  }

  /**
   * Upcoming releases of the games the user tracks, when their day is known —
   * or their month, on its 1st. A vaguer date has no day to sit on.
   */
  private async calendarGames(userId: string): Promise<CalendarEntryDto[]> {
    const today = new Date().toISOString().slice(0, 10);
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId,
        status: { not: "DROPPED" },
        user: { enabledDomains: { has: "GAMES" } },
        gameItem: {
          releaseDatePrecision: { in: ["DAY", "MONTH"] },
          releaseDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
      },
      include: { gameItem: { include: { externalIds: true } } },
    });
    return entries.map((entry) => ({
      mediaItem: null,
      game: toGameItemDto(entry.gameItem),
      entryId: entry.id,
      episodeAlertsMuted: !entry.releaseReminderAt,
      episodesBehind: 0,
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
      releasePrecision:
        entry.gameItem.releaseDatePrecision === "MONTH" ? "MONTH" : "DAY",
      // Non-null: guaranteed by the `gte` filter above.
      airDate: entry.gameItem.releaseDate!.toISOString(),
    }));
  }

  /**
   * Undo watching an episode: removes the user's most recent watch for it
   * (so it decrements a rewatch count, and unwatches the episode at one watch).
   */
  async unwatchEpisode(userId: string, episodeId: string): Promise<void> {
    const latest = await this.prisma.episodeWatch.findFirst({
      where: { userId, episodeId },
      orderBy: { watchedAt: { sort: "desc", nulls: "last" } },
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

    await this.assertMediaOwnership(userId, latest.episode.season.mediaItemId);

    await this.prisma.episodeWatch.delete({ where: { id: latest.id } });
    await this.xp.revokeBySource("EpisodeWatch", [latest.id]);
    await this.syncSeasonAndSeriesXp(userId, [latest.episode.seasonId]);
    await this.syncFinishedAt(
      userId,
      latest.episode.season.mediaItemId,
      latest.episode.season.mediaItem.type,
    );
  }

  private assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.libraryEntry.findUnique({ where: { id: entryId } }),
    );
  }

  /**
   * Sibling of `assertEntryOwnership` for the watch endpoints, which are
   * addressed by episode/season id and so only know the media item. A missing
   * entry is a 403, never an implicit "track it for them": creating one here
   * would fire WORK_ADDED/DOMAIN_STARTED off a request that never asked to
   * follow the work.
   */
  private async assertMediaOwnership(
    userId: string,
    mediaItemId: string,
  ): Promise<void> {
    const entry = await this.prisma.libraryEntry.findUnique({
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
   * Batched form of `computeProgress` + `lastWatchedAt` for `listEntries`:
   * that call site was doing 2-3 DB round trips *per entry* (fine for
   * `getEntry`'s single row, but a query storm across a whole library),
   * so this fetches every relevant episode/watch once and reduces them
   * per media item in memory instead.
   */
  /**
   * Per media: its regular episodes, how many of them the user watched, and
   * their last viewing of any episode (specials included) — the counts
   * computeProgressBatch derives, without loading every episode and watch.
   */
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
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId, mediaItem: { externalIds: { some: externalId } } },
      select: {
        status: true,
        mediaItemId: true,
        mediaItem: {
          select: {
            type: true,
            status: true,
            externalIds: {
              where: { source: externalId.source, type },
              select: { externalId: true },
            },
          },
        },
      },
    });
    const counts = await this.progressCounts(
      userId,
      entries.map((e) => e.mediaItemId),
    );

    const statuses = new Map<string, EntryStatus>();

    for (const entry of entries) {
      const sourceId = entry.mediaItem.externalIds[0]?.externalId;
      if (!sourceId) continue;
      const count = counts.get(entry.mediaItemId);
      const progress =
        count && count.total > 0
          ? {
              watchedEpisodes: count.watched,
              totalEpisodes: count.total,
              nextEpisode: null,
            }
          : null;
      statuses.set(
        sourceId,
        deriveStatus(
          entry.mediaItem.type,
          progress,
          normalizeAiringFinished(entry.mediaItem.status),
          entry.status,
        ),
      );
    }

    return statuses;
  }

  private async progressCounts(
    userId: string,
    mediaItemIds: string[],
  ): Promise<
    Map<string, { total: number; watched: number; lastWatchedAt: Date | null }>
  > {
    if (mediaItemIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      {
        mediaItemId: string;
        total: bigint;
        watched: bigint;
        lastWatchedAt: Date | null;
      }[]
    >`
      SELECT s."mediaItemId",
             COUNT(DISTINCT e.id) FILTER (WHERE s.number > 0) AS total,
             COUNT(DISTINCT w."episodeId") FILTER (WHERE s.number > 0) AS watched,
             MAX(w."watchedAt") AS "lastWatchedAt"
      FROM "Season" s
      JOIN "Episode" e ON e."seasonId" = s.id
      LEFT JOIN "EpisodeWatch" w
        ON w."episodeId" = e.id AND w."userId" = ${userId}
      WHERE s."mediaItemId" = ANY(${mediaItemIds})
      GROUP BY s."mediaItemId"
    `;
    return new Map(
      rows.map((r) => [
        r.mediaItemId,
        {
          total: Number(r.total),
          watched: Number(r.watched),
          lastWatchedAt: r.lastWatchedAt,
        },
      ]),
    );
  }

  /**
   * Per media: regular episodes aired before `before` (or undated — AniList's
   * generated ones, available like in `computeProgress`) the user never
   * watched. Media with no backlog are absent from the map.
   */
  private async episodesBehind(
    userId: string,
    mediaItemIds: string[],
    before: Date,
  ): Promise<Map<string, number>> {
    if (mediaItemIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      { mediaItemId: string; behind: bigint }[]
    >`
      SELECT s."mediaItemId", COUNT(*) AS behind
      FROM "Season" s
      JOIN "Episode" e ON e."seasonId" = s.id
      WHERE s."mediaItemId" = ANY(${mediaItemIds})
        AND s.number > 0
        AND (e."airDate" IS NULL OR e."airDate" < ${before})
        AND NOT EXISTS (
          SELECT 1 FROM "EpisodeWatch" w
          WHERE w."episodeId" = e.id AND w."userId" = ${userId}
        )
      GROUP BY s."mediaItemId"
    `;
    return new Map(rows.map((r) => [r.mediaItemId, Number(r.behind)]));
  }

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

      if (w.watchedAt) {
        const prevLast = lastWatchedByMedia.get(mediaItemId);
        if (!prevLast || w.watchedAt > prevLast)
          lastWatchedByMedia.set(mediaItemId, w.watchedAt);
      }

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

  /**
   * Season 0 holds specials on TMDB: they are watchable but excluded from the
   * watched/total progress so "100%" means the regular run is complete.
   */
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
      episodeAlertsMuted: entry.episodeAlertsMuted,
      ...(entry.movieReleaseReminderAt
        ? { movieReleaseAlertsEnabled: true }
        : {}),
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

    await assertMediaReleased(this.prisma, entry.mediaItemId);

    const replay = await this.prisma.movieReplay.create({
      data: {
        libraryEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });
    await this.xp.award(userId, XpReason.MOVIE_REPLAYED, replay.id);

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
            select: { libraryEntry: { select: { userId: true } } },
          })
        )?.libraryEntry.userId ?? null,
      remove: () => this.prisma.movieReplay.delete({ where: { id: replayId } }),
    });
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
    acceptLanguage?: string,
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
      if (type === "MOVIE" && ref.mediaItem.movieReleaseDates === null) {
        ref.mediaItem = await this.mediaItemService.upsertFromSource(
          source,
          sourceId,
          type,
        );
      }

      const detail = await this.mediaDetailFromCache(
        userId,
        source,
        sourceId,
        ref.mediaItem,
        type,
        lang,
        acceptLanguage,
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
    const region =
      type === "MOVIE" ? await this.movieRegion(userId, acceptLanguage) : "US";
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
      releaseDate: details.releaseDate ?? null,
      movieRelease:
        type === "MOVIE"
          ? movieReleaseInfo(
              details.movieReleaseDates ?? [],
              details.status,
              region,
            )
          : null,
      airingFinished: normalizeAiringFinished(details.status),
      runtimeMin: details.runtimeMin,
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
          runtimeMin: episode.runtimeMin,
          watchCount: 0,
          watches: [],
        })),
      })),
      commentTargetId: null,
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
    acceptLanguage?: string,
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
              orderBy: { watchedAt: { sort: "desc", nulls: "last" } },
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
      releaseDate: media.releaseDate?.toISOString().slice(0, 10) ?? null,
      movieRelease:
        type === "MOVIE"
          ? movieReleaseInfo(
              movieReleaseDates(media.movieReleaseDates),
              media.status,
              await this.movieRegion(userId, acceptLanguage),
            )
          : null,
      airingFinished: normalizeAiringFinished(media.status),
      runtimeMin: media.runtimeMin,
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
          runtimeMin: episode.runtimeMin,
          watchCount: episode.watches.length,
          watches: episode.watches.map((w) => ({
            id: w.id,
            episodeId: episode.id,
            watchedAt: w.watchedAt?.toISOString() ?? null,
          })),
        })),
      })),
      commentTargetId: media.id,
      entry,
    };
  }

  private async movieRegion(
    userId: string,
    acceptLanguage?: string,
  ): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { watchRegion: true },
    });
    return resolveWatchRegion(user.watchRegion ?? undefined, acceptLanguage);
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
    ...((media.type === "MOVIE" &&
      movieReleaseInfo(
        movieReleaseDates(media.movieReleaseDates),
        media.status,
        "US",
      ).upcoming) ||
    (media.type === "ANIME" && isAnimeUnaired(media.status))
      ? { upcoming: true }
      : {}),
  };
}

function toReplayDto(replay: MovieReplay): MovieReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}
