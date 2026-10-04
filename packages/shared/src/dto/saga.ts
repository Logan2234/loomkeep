import type { BookStatus, EntryStatus } from "../enums";
import type { BookSummaryDto } from "./book";
import type { MediaSummaryDto } from "./catalog";

/** One work of a saga, in viewing order. */
export interface SagaMemberDto extends MediaSummaryDto {
  /** ISO date of its (first) release, when the source knows it. */
  releaseDate: string | null;
  /** AniList release format ("TV", "MOVIE", "OVA"…); null for a TMDB film. */
  format: string | null;
  episodes: number | null;
  /** Announced but not out yet: shown, never counted in the progress. */
  upcoming: boolean;
  /** The viewer's effective library status, null when not tracked. */
  status: EntryStatus | null;
}

/**
 * A film's TMDB collection, or an anime's main line on AniList (the chain of
 * prequels and sequels — side stories stay in the related works).
 */
export interface MediaSagaDto {
  /** Stable id of the saga, e.g. `TMDB:10194` or `ANILIST:16498`. */
  key: string;
  title: string;
  members: SagaMemberDto[];
}

export interface MediaSagaResponseDto {
  /** Null when the work belongs to no saga of two works or more. */
  saga: MediaSagaDto | null;
}

/** A saga from the viewer's own library, for the "Sagas" view. */
export interface LibrarySagaDto<M = SagaMemberDto> {
  key: string;
  title: string;
  members: M[];
  /**
   * What's next: the first released work not seen, or else the announced
   * one. Null once the saga is finished.
   */
  next: M | null;
  /** Finished (or caught-up) works, out of `released`. */
  seen: number;
  released: number;
  /** When the viewer last touched a work of the saga. */
  lastActivityAt: string;
  /** When the viewer last finished a work of the saga, if ever. */
  finishedAt: string | null;
}

export interface LibrarySagasDto<M = SagaMemberDto> {
  /** At least one work finished and one released work still to see. */
  inProgress: LibrarySagaDto<M>[];
  /** Everything released is seen, and a sequel is announced. */
  waiting: LibrarySagaDto<M>[];
  /** Everything seen or dropped, nothing announced. */
  finished: LibrarySagaDto<M>[];
}

/** One volume of a book series, in reading order. */
export interface BookSagaMemberDto extends BookSummaryDto {
  /** Its number in the series: whole volumes only, no novella or omnibus. */
  position: number;
  /** The reader's library status, null when not tracked. */
  status: BookStatus | null;
}

/** An Open Library series, kept to its numbered volumes. */
export interface BookSagaDto {
  /** Open Library's series id, e.g. `OL326110L`. */
  key: string;
  title: string;
  members: BookSagaMemberDto[];
}

export interface BookSagaResponseDto {
  /** Null when the series has fewer than two numbered volumes. */
  saga: BookSagaDto | null;
}

/** The reader's book series. Open Library catalogues a book once out, so none waits on a sequel. */
export type LibraryBookSagasDto = LibrarySagasDto<BookSagaMemberDto>;

export const LIBRARY_SAGA_SORTS = ["recent", "title", "progress"] as const;
export type LibrarySagaSort = (typeof LIBRARY_SAGA_SORTS)[number];
