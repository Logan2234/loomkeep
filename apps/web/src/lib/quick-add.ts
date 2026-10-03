import {
  bulkUpdateLibraryEntries,
  deleteBookEntry,
  deleteGameEntry,
  deleteLibraryEntry,
  deleteMusicEntry,
  getBookDetail,
  getGameDetail,
  getMediaDetail,
  getMusicDetail,
  updateBookEntry,
  updateGameEntry,
  updateLibraryEntry,
  updateMusicEntry,
  upsertBookEntry,
  upsertGameEntry,
  upsertLibraryEntry,
  upsertMusicEntry,
} from "$lib/api/client";
import { keys } from "$lib/api/keys";
import {
  BOOK_STATUS_LABELS,
  GAME_STATUS_LABELS,
  MEDIA_STATUS_META,
  MUSIC_STATUS_LABELS,
} from "$lib/constants/status-labels";
import { m } from "$lib/paraglide/messages.js";
import type {
  BookStatus,
  EntryStatus,
  GameStatus,
  ListItemTargetType,
  MediaType,
  MusicStatus,
} from "@loomkeep/shared";

/** A work page the quick-add panel can track, read from a resolved link's href. */
export type QuickAddTarget =
  | { domain: "MEDIA"; type: MediaType; id: string }
  | { domain: "GAMES" | "BOOKS" | "MUSIC"; id: string };

const MEDIA_HREF = /^\/app\/media\/(movie|series|anime)\/([^/?#]+)$/;
const WORK_HREF = /^\/app\/(games|books|music)\/([^/?#]+)$/;

/** Null for any other Loomkeep page (a profile, a list…), which opens as is. */
export function quickAddTarget(href: string): QuickAddTarget | null {
  const media = MEDIA_HREF.exec(href);

  if (media) {
    return {
      domain: "MEDIA",
      type: media[1].toUpperCase() as MediaType,
      id: decodeURIComponent(media[2]),
    };
  }

  const work = WORK_HREF.exec(href);
  if (!work) return null;
  return {
    domain: work[1].toUpperCase() as "GAMES" | "BOOKS" | "MUSIC",
    id: decodeURIComponent(work[2]),
  };
}

interface QuickAddView {
  upcoming?: boolean;
  title: string;
  posterUrl: string | null;
  /** Kind, year and creator, as far as the source knows them. */
  meta: string[];
  entryId: string | null;
  /** The cached work id lists point at; null until the work is tracked. */
  itemId: string | null;
  status: string | null;
  /** Reading progress, for a book already on the shelf. */
  progress: string | null;
}

export interface QuickAddDomain {
  listType: ListItemTargetType;
  /** "Dropped" is left out on purpose: nobody adds a work to drop it. */
  statuses: { value: string; label: string }[];
  /** Every status the domain has, for an entry already in another one. */
  labels: Record<string, string>;
  /** What picking "completed" does beyond the status, when it does more. */
  completedHint: string | null;
  key: readonly unknown[];
  fetch: () => Promise<unknown>;
  view: (detail: unknown) => QuickAddView;
  add: (
    detail: unknown,
    status: string,
  ) => Promise<{ entryId: string; itemId: string }>;
  setStatus: (entryId: string, status: string) => Promise<unknown>;
  remove: (entryId: string) => Promise<unknown>;
}

const compact = (values: (string | number | null | undefined)[]) =>
  values.filter((v) => v !== null && v !== undefined && v !== "").map(String);

const pick = <T extends string>(labels: Record<T, string>, values: T[]) =>
  values.map((value) => ({ value, label: labels[value] }));

type MediaDetail = Awaited<ReturnType<typeof getMediaDetail>>;
type GameDetail = Awaited<ReturnType<typeof getGameDetail>>;
type BookDetail = Awaited<ReturnType<typeof getBookDetail>>;
type MusicDetail = Awaited<ReturnType<typeof getMusicDetail>>;

const MEDIA_KIND: Record<MediaType, () => string> = {
  MOVIE: m.media_movie,
  SERIES: m.media_series,
  ANIME: m.media_anime,
};

// A series is "seen" once its aired episodes are: the bulk endpoint marks
// them, as the library's bulk "Terminé" does. A plain status patch wouldn't.
function setMediaStatus(entryId: string, status: string) {
  return status === "COMPLETED"
    ? bulkUpdateLibraryEntries({ ids: [entryId], status: "COMPLETED" })
    : updateLibraryEntry(entryId, { status: status as EntryStatus });
}

function mediaDomain(type: MediaType, id: string): QuickAddDomain {
  return {
    listType: "MEDIA",
    statuses: [
      { value: "PLANNED", label: m.media_status_planned() },
      ...(type === "MOVIE"
        ? []
        : [{ value: "WATCHING", label: m.library_status_in_progress() }]),
      { value: "COMPLETED", label: m.quick_add_seen() },
    ],
    labels: Object.fromEntries(
      Object.entries(MEDIA_STATUS_META).map(([k, v]) => [k, v.label]),
    ),
    completedHint: type === "MOVIE" ? null : m.quick_add_series_seen_hint(),
    key: keys.media.detail(type, id),
    fetch: () => getMediaDetail(type, id),
    view: (raw) => {
      const d = raw as MediaDetail;
      return {
        title: d.title,
        posterUrl: d.posterUrl,
        meta: compact([MEDIA_KIND[type](), d.year]),
        entryId: d.entry?.id ?? null,
        itemId: d.entry?.mediaItem.id ?? null,
        status: d.entry?.status ?? null,
        upcoming: d.movieRelease?.upcoming,
        progress: null,
      };
    },
    add: async (raw, status) => {
      const d = raw as MediaDetail;
      const entry = await upsertLibraryEntry({
        source: d.source,
        sourceId: d.sourceId,
        type: d.type,
        status: status === "WATCHING" ? "WATCHING" : "PLANNED",
      });
      if (status === "COMPLETED") await setMediaStatus(entry.id, status);
      return { entryId: entry.id, itemId: entry.mediaItem.id };
    },
    setStatus: setMediaStatus,
    remove: deleteLibraryEntry,
  };
}

function gameDomain(id: string): QuickAddDomain {
  return {
    listType: "GAME",
    statuses: pick<GameStatus>(GAME_STATUS_LABELS, [
      "BACKLOG",
      "PLAYING",
      "COMPLETED",
    ]),
    labels: GAME_STATUS_LABELS,
    completedHint: null,
    key: keys.games.detail("igdb", id),
    fetch: () => getGameDetail("igdb", id),
    view: (raw) => {
      const d = raw as GameDetail;
      return {
        title: d.title,
        posterUrl: d.coverUrl,
        meta: compact([m.common_game(), d.year, d.developers[0]]),
        entryId: d.entry?.id ?? null,
        itemId: d.entry?.game.id ?? null,
        status: d.entry?.status ?? null,
        progress: null,
      };
    },
    add: async (raw, status) => {
      const d = raw as GameDetail;
      const entry = await upsertGameEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: status as GameStatus,
      });
      return { entryId: entry.id, itemId: entry.game.id };
    },
    setStatus: (entryId, status) =>
      updateGameEntry(entryId, { status: status as GameStatus }),
    remove: deleteGameEntry,
  };
}

function bookDomain(id: string): QuickAddDomain {
  return {
    listType: "BOOK",
    statuses: pick<BookStatus>(BOOK_STATUS_LABELS, [
      "TO_READ",
      "READING",
      "READ",
    ]),
    labels: BOOK_STATUS_LABELS,
    completedHint: null,
    // No edition: the key the book page itself starts from.
    key: keys.books.detail("open_library", id, undefined),
    fetch: () => getBookDetail("open_library", id),
    view: (raw) => {
      const d = raw as BookDetail;
      const pages = d.entry?.referencePageCount ?? d.pageCount;
      return {
        title: d.title,
        posterUrl: d.coverUrl,
        meta: compact([m.common_book(), d.year, d.authors[0]]),
        entryId: d.entry?.id ?? null,
        itemId: d.entry?.book.id ?? null,
        status: d.entry?.status ?? null,
        progress:
          d.entry?.status === "READING" && pages
            ? m.quick_add_book_progress({
                page: d.entry.currentPage,
                total: pages,
              })
            : null,
      };
    },
    add: async (raw, status) => {
      const d = raw as BookDetail;
      const entry = await upsertBookEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: status as BookStatus,
        editionKey: d.editionKey,
        referencePageCount: d.pageCount,
      });
      return { entryId: entry.id, itemId: entry.book.id };
    },
    setStatus: (entryId, status) =>
      updateBookEntry(entryId, { status: status as BookStatus }),
    remove: deleteBookEntry,
  };
}

function musicDomain(id: string): QuickAddDomain {
  return {
    listType: "MUSIC",
    statuses: pick<MusicStatus>(MUSIC_STATUS_LABELS, ["TO_LISTEN", "LISTENED"]),
    labels: MUSIC_STATUS_LABELS,
    completedHint: null,
    key: keys.music.detail("musicbrainz", id),
    fetch: () => getMusicDetail("musicbrainz", id),
    view: (raw) => {
      const d = raw as MusicDetail;
      return {
        title: d.title,
        posterUrl: d.coverUrl,
        meta: compact([m.music_album(), d.year, d.artists[0]]),
        entryId: d.entry?.id ?? null,
        itemId: d.entry?.album.id ?? null,
        status: d.entry?.status ?? null,
        progress: null,
      };
    },
    add: async (raw, status) => {
      const d = raw as MusicDetail;
      const entry = await upsertMusicEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: status as MusicStatus,
      });
      return { entryId: entry.id, itemId: entry.album.id };
    },
    setStatus: (entryId, status) =>
      updateMusicEntry(entryId, { status: status as MusicStatus }),
    remove: deleteMusicEntry,
  };
}

export function quickAddDomain(target: QuickAddTarget): QuickAddDomain {
  switch (target.domain) {
    case "MEDIA":
      return mediaDomain(target.type, target.id);
    case "GAMES":
      return gameDomain(target.id);
    case "BOOKS":
      return bookDomain(target.id);
    case "MUSIC":
      return musicDomain(target.id);
  }
}
