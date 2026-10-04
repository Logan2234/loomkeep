import { formatDate, joinMeta } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import type {
  BookSagaMemberDto,
  BookStatus,
  EntryStatus,
  LibrarySagaDto,
  LibrarySagasDto,
  SagaMemberDto,
} from "@loomkeep/shared";

/**
 * One work of a saga as the saga block and the sagas view draw it, whatever
 * its domain: each domain maps its own DTO onto this.
 */
export interface SagaMemberView {
  id: string;
  title: string;
  posterUrl: string | null;
  href: string;
  /** Year, format… or the release date of an announced work. */
  meta: string;
  /** Its own number in the saga (a book's volume); null to count in order. */
  position: number | null;
  upcoming: boolean;
  /** Counts in the progress: finished (or caught up). */
  seen: boolean;
  /** A work given up on is no longer "next". */
  dropped: boolean;
  segmentClass: string;
  badge:
    | { domain: "MEDIA"; status: EntryStatus }
    | { domain: "BOOKS"; status: BookStatus }
    | null;
}

export interface LibrarySagaView {
  key: string;
  title: string;
  /** What the saga is made of ("Films", "Animés"), when it can vary. */
  kind: string | null;
  members: SagaMemberView[];
  next: SagaMemberView | null;
  seen: number;
  released: number;
  finishedAt: string | null;
}

export interface LibrarySagasView {
  inProgress: LibrarySagaView[];
  waiting: LibrarySagaView[];
  finished: LibrarySagaView[];
}

/** A domain's sagas, as the sagas view lists them. */
export function librarySagasView<M>(
  sagas: LibrarySagasDto<M>,
  member: (x: M) => SagaMemberView,
  kind: (saga: LibrarySagaDto<M>) => string | null = () => null,
): LibrarySagasView {
  const view = (saga: LibrarySagaDto<M>): LibrarySagaView => ({
    key: saga.key,
    title: saga.title,
    kind: kind(saga),
    members: saga.members.map(member),
    next: saga.next ? member(saga.next) : null,
    seen: saga.seen,
    released: saga.released,
    finishedAt: saga.finishedAt,
  });
  return {
    inProgress: sagas.inProgress.map(view),
    waiting: sagas.waiting.map(view),
    finished: sagas.finished.map(view),
  };
}

// ── Films and anime ──

const SEGMENT_COLORS: Record<EntryStatus, string> = {
  COMPLETED: "bg-success",
  UP_TO_DATE: "bg-success",
  WATCHING: "bg-accent",
  PLANNED: "bg-dim/55",
  DROPPED: "bg-danger",
};

/** A saga segment's fill: the work's status, faint when not tracked. */
const sagaSegmentClass = (x: SagaMemberDto) =>
  x.status
    ? SEGMENT_COLORS[x.status]
    : x.upcoming
      ? "border-border border border-dashed"
      : "bg-surface-2";

const sagaMemberHref = (x: SagaMemberDto) =>
  `/app/media/${x.type.toLowerCase()}/${x.sourceId}`;

const formats = (): Record<string, string> => ({
  MOVIE: m.media_movie(),
  SPECIAL: m.media_special(),
  TV_SHORT: m.media_short_series(),
});

/** Year · format · episodes, or the release date of an announced work. */
const sagaMemberMeta = (x: SagaMemberDto) =>
  x.upcoming
    ? m.media_saga_upcoming_on({
        date: x.releaseDate ? formatDate(x.releaseDate) : "—",
      })
    : joinMeta(
        x.year !== null ? String(x.year) : null,
        x.format ? (formats()[x.format] ?? x.format) : null,
        x.episodes ? `${x.episodes} ${m.media_episode_short()}` : null,
      );

export const mediaSagaMember = (x: SagaMemberDto): SagaMemberView => ({
  id: x.sourceId,
  title: x.title,
  posterUrl: x.posterUrl,
  href: sagaMemberHref(x),
  meta: sagaMemberMeta(x),
  position: null,
  upcoming: x.upcoming,
  // A work still airing that you're caught up on counts as seen.
  seen: x.status === "COMPLETED" || x.status === "UP_TO_DATE",
  dropped: x.status === "DROPPED",
  segmentClass: sagaSegmentClass(x),
  badge: x.status ? { domain: "MEDIA", status: x.status } : null,
});

// ── Books ──

const BOOK_SEGMENT_COLORS: Record<BookStatus, string> = {
  READ: "bg-success",
  READING: "bg-accent",
  TO_READ: "bg-dim/55",
  DROPPED: "bg-danger",
};

export const bookSagaMember = (x: BookSagaMemberDto): SagaMemberView => ({
  id: x.sourceId,
  title: x.title,
  posterUrl: x.coverUrl,
  href: `/app/books/${x.sourceId}`,
  meta: x.year !== null ? String(x.year) : "",
  position: x.position,
  upcoming: false,
  seen: x.status === "READ",
  dropped: x.status === "DROPPED",
  segmentClass: x.status ? BOOK_SEGMENT_COLORS[x.status] : "bg-surface-2",
  badge: x.status ? { domain: "BOOKS", status: x.status } : null,
});
