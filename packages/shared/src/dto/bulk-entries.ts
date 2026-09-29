import type { SavedViewFiltersDto } from "./saved-view";

/** Explicit picks a bulk action accepts at most; past that, target the filters instead. */
export const BULK_ENTRIES_MAX_IDS = 500;

/**
 * The statuses a bulk action can set on media. A media status is derived
 * from its viewings: "planned" or "in progress" would mean erasing them, so
 * only completing (every aired episode, or the movie) and dropping are offered.
 */
export const MEDIA_BULK_STATUSES = ["COMPLETED", "DROPPED"] as const;

/**
 * Which entries a bulk action targets: exactly one of the explicit `ids`, or
 * every entry the library list shows under `filters` (loaded or not).
 */
export interface BulkEntriesTargetDto {
  ids?: string[];
  filters?: SavedViewFiltersDto;
}

/** A bulk change: the target, plus exactly one of the actions. */
export interface BulkUpdateEntriesDto<
  Status extends string = string,
  Ownership extends string = string,
> extends BulkEntriesTargetDto {
  status?: Status;
  ownershipStatus?: Ownership;
  favorite?: boolean;
  /** Adds the entries' works to this list. */
  listId?: string;
}

export interface BulkEntriesResultDto {
  updated: number;
  /** Already in that state, already in the list, or not applicable (e.g. a movie with nothing to mark). */
  skipped: number;
}
