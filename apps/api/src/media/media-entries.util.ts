import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  type LibraryEntryDto,
  type MediaItemDto,
  type MediaSortKey,
  type MovieReplayDto,
  type ProgressDto,
  progressPercent,
} from "@loomkeep/shared/contracts";
import { EntryStatus, MediaType } from "@loomkeep/shared/enums";
import { nextInRewatch } from "./rewatch.util";

import { HttpStatus } from "@nestjs/common";
import type { MovieReplay, Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { compareTitles, timeMs } from "../common/sort.util";
import type { ListEntriesFilters as SharedListEntriesFilters } from "../work/entry-lifecycle.util";

import { LOAN_INCLUDE } from "../work/entry-loan.util";

// Reused include: entries always need the media + its external IDs (sourceId),
// plus their replay history (movies only in practice), most recent first.
export const ENTRY_INCLUDE = {
  mediaItem: { include: { externalIds: true } },
  ...LOAN_INCLUDE,
  replays: { orderBy: { finishedAt: "desc" } },
} satisfies Prisma.MediaEntryInclude;

/** MediaEntry joined with its media and the media's external IDs. */
export type EntryWithMedia = Prisma.MediaEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

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
export type MediaRow = Pick<
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

export const MEDIA_ROW_SELECT = {
  id: true,
  mediaItemId: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  watchedEpisodes: true,
  lastWatchedAt: true,
  rewatchStartedAt: true,
  mediaItem: {
    select: { type: true, status: true, title: true, episodeCount: true },
  },
} satisfies Prisma.MediaEntrySelect;

/**
 * An entry's progress from its materialized counts (kept by the database,
 * see MediaEntry.watchedEpisodes) — null for a work with no regular
 * episode, as computeProgress has it. No next episode: only the page gets one.
 */
export function materializedProgress(entry: {
  watchedEpisodes: number;
  mediaItem: { episodeCount: number };
}): ProgressDto | null {
  return entry.mediaItem.episodeCount > 0
    ? {
        watchedEpisodes: entry.watchedEpisodes,
        totalEpisodes: entry.mediaItem.episodeCount,
        nextEpisode: null,
      }
    : null;
}

// A day ahead covers a date the viewer picked in their own time zone (up to
// UTC+14) and clock drift; anything beyond is a mistake, and a 2099 viewing
// would pin the show at the top of "recent" for good.
const WATCH_DATE_FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function assertWatchDateNotFuture(
  watchedAt: string | null | undefined,
  now = new Date(),
): void {
  if (
    watchedAt &&
    new Date(watchedAt).getTime() >
      now.getTime() + WATCH_DATE_FUTURE_TOLERANCE_MS
  ) {
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ValidationFailed);
  }
}

/**
 * Whether a viewing belongs to the current one: any viewing outside a
 * rewatch, only those since it began during one. An undated (imported)
 * viewing always predates a rewatch.
 */
export function seenInViewing(
  watchedAt: Date | null,
  rewatchStartedAt: Date | null,
): boolean {
  return (
    !rewatchStartedAt || (watchedAt !== null && watchedAt >= rewatchStartedAt)
  );
}

/** The EpisodeWatch filter matching `seenInViewing`. */
export const inViewing = (
  rewatchStartedAt: Date | null,
): Prisma.EpisodeWatchWhereInput =>
  rewatchStartedAt ? { watchedAt: { gte: rewatchStartedAt } } : {};

/**
 * The episode to watch next among the regular run, in airing order: the first
 * aired one not watched (null airDate = AniList's generated episodes, treated
 * as available), or during a rewatch the one following the last episode seen
 * again — `watchedIds` then holds only the viewings since the rewatch began.
 */
export function nextEpisodeOf<E extends { id: string; airDate: Date | null }>(
  run: E[],
  watchedIds: Set<string>,
  rewatching: boolean,
  now: Date,
): E | null {
  const aired = run.filter((e) => e.airDate === null || e.airDate <= now);
  return rewatching
    ? nextInRewatch(aired, (e) => watchedIds.has(e.id))
    : (aired.find((e) => !watchedIds.has(e.id)) ?? null);
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
export function compareMediaEntries(
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
      // The whole series' progress (the triggers' watchedEpisodes), even
      // during a rewatch whose card shows its own: accepted and documented
      // in the guide rather than materialising a second count.
      return progressPercent(b.progress) - progressPercent(a.progress);
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
      return lastActivityMs(b) - lastActivityMs(a);
  }
}

/**
 * When an entry last moved: its latest viewing, or when it was added if that
 * came later. A title never watched yet (a planned movie) then sits where it
 * was added among the series being watched, not after all of them.
 */
function lastActivityMs(
  row: Pick<MediaRow, "lastWatchedAt" | "createdAt">,
): number {
  return Math.max(timeMs(row.lastWatchedAt), timeMs(row.createdAt));
}

export const NO_COMMUNITY_RATING = {
  reviewCount: null,
  reviewAverage: null,
  myRating: null,
} as const;

export function toReplayDto(replay: MovieReplay): MovieReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}
