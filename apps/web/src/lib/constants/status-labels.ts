import { m } from "#lib/paraglide/messages.js";
import {
  type MediaFilterStatus,
  type SavedViewDomain,
  SESSION_FILTER_PAUSED,
} from "@loomkeep/shared/contracts";
import {
  type BookStatus,
  type EntryStatus,
  type GameStatus,
  type MusicStatus,
} from "@loomkeep/shared/enums";

export const MEDIA_STATUS_META: Record<
  EntryStatus,
  { label: string; cls: string }
> = {
  PLANNED: {
    get label() {
      return m.media_status_planned();
    },
    cls: "bg-surface-2 text-dim",
  },
  WATCHING: {
    get label() {
      return m.library_status_in_progress();
    },
    cls: "bg-accent text-accent-fg",
  },
  UP_TO_DATE: {
    get label() {
      return m.media_status_caught_up();
    },
    cls: "border border-success text-success",
  },
  COMPLETED: {
    get label() {
      return m.library_status_completed();
    },
    cls: "bg-success/15 text-success",
  },
  DROPPED: {
    get label() {
      return m.library_status_dropped();
    },
    cls: "border border-danger text-danger",
  },
};

export const MEDIA_STATUS_DESC: Record<EntryStatus, string> = {
  get PLANNED() {
    return m.media_status_planned_hint();
  },
  get WATCHING() {
    return m.media_status_watching_hint();
  },
  get UP_TO_DATE() {
    return m.media_status_caught_up_hint();
  },
  get COMPLETED() {
    return m.media_status_completed_hint();
  },
  get DROPPED() {
    return m.library_status_dropped_description();
  },
};

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  get TO_READ() {
    return m.book_status_to_read();
  },
  get READING() {
    return m.book_status_reading();
  },
  get READ() {
    return m.book_status_read();
  },
  get DROPPED() {
    return m.library_status_dropped();
  },
};

export const BOOK_STATUS_ORDER: BookStatus[] = [
  "TO_READ",
  "READING",
  "READ",
  "DROPPED",
];

export const BOOK_STATUS_META: Record<
  BookStatus,
  { label: string; cls: string }
> = {
  TO_READ: {
    get label() {
      return m.book_status_to_read();
    },
    cls: "bg-surface-2 text-dim",
  },
  READING: {
    get label() {
      return m.book_status_reading();
    },
    cls: "bg-accent text-accent-fg",
  },
  READ: {
    get label() {
      return m.book_status_read();
    },
    cls: "bg-success/15 text-success",
  },
  DROPPED: {
    get label() {
      return m.library_status_dropped();
    },
    cls: "border border-danger text-danger",
  },
};

export const BOOK_STATUS_DESC: Record<BookStatus, string> = {
  get TO_READ() {
    return m.library_status_backlog_description();
  },
  get READING() {
    return m.book_status_reading_description();
  },
  get READ() {
    return m.book_status_read_description();
  },
  get DROPPED() {
    return m.library_status_dropped_description();
  },
};

export const BOOK_STATUS_SEG_ACTIVE: Record<BookStatus, string> = {
  TO_READ: "bg-surface text-fg shadow-sm",
  READING: "bg-accent text-accent-fg",
  READ: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  get BACKLOG() {
    return m.game_status_backlog();
  },
  get PLAYING() {
    return m.game_status_playing();
  },
  get COMPLETED() {
    return m.library_status_completed();
  },
  get DROPPED() {
    return m.library_status_dropped();
  },
};

export const GAME_STATUS_ORDER: GameStatus[] = [
  "BACKLOG",
  "PLAYING",
  "COMPLETED",
  "DROPPED",
];

export const GAME_STATUS_META: Record<
  GameStatus,
  { label: string; cls: string }
> = {
  BACKLOG: {
    get label() {
      return m.game_status_backlog();
    },
    cls: "bg-surface-2 text-dim",
  },
  PLAYING: {
    get label() {
      return m.game_status_playing();
    },
    cls: "bg-accent text-accent-fg",
  },
  COMPLETED: {
    get label() {
      return m.library_status_completed();
    },
    cls: "bg-success/15 text-success",
  },
  DROPPED: {
    get label() {
      return m.library_status_dropped();
    },
    cls: "border border-danger text-danger",
  },
};

export const GAME_STATUS_DESC: Record<GameStatus, string> = {
  get BACKLOG() {
    return m.library_status_backlog_description();
  },
  get PLAYING() {
    return m.game_status_playing_description();
  },
  get COMPLETED() {
    return m.game_status_completed_description();
  },
  get DROPPED() {
    return m.library_status_dropped_description();
  },
};

export const GAME_STATUS_SEG_ACTIVE: Record<GameStatus, string> = {
  BACKLOG: "bg-surface text-fg shadow-sm",
  PLAYING: "bg-accent text-accent-fg",
  COMPLETED: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

export const MUSIC_STATUS_LABELS: Record<MusicStatus, string> = {
  get TO_LISTEN() {
    return m.music_status_to_listen();
  },
  get LISTENED() {
    return m.music_status_listened();
  },
};

export const MUSIC_STATUS_ORDER: MusicStatus[] = ["TO_LISTEN", "LISTENED"];

export const MUSIC_STATUS_META: Record<
  MusicStatus,
  { label: string; cls: string }
> = {
  TO_LISTEN: {
    get label() {
      return m.music_status_to_listen();
    },
    cls: "bg-surface-2 text-dim",
  },
  LISTENED: {
    get label() {
      return m.music_status_listened();
    },
    cls: "bg-success/15 text-success",
  },
};

export const MUSIC_STATUS_DESC: Record<MusicStatus, string> = {
  get TO_LISTEN() {
    return m.music_status_to_listen_description();
  },
  get LISTENED() {
    return m.music_status_listened_description();
  },
};

export const MUSIC_STATUS_SEG_ACTIVE: Record<MusicStatus, string> = {
  TO_LISTEN: "bg-surface text-fg shadow-sm",
  LISTENED: "bg-success/20 text-success",
};

export const MEDIA_STATUS_ORDER = [
  "WATCHING",
  "PLANNED",
  "COMPLETED",
  "DORMANT",
  "GHOST",
  "DROPPED",
] as const satisfies readonly MediaFilterStatus[];

export function mediaFilterLabel(status: MediaFilterStatus): string {
  if (status === "DORMANT") return m.media_status_paused();
  if (status === "GHOST") return m.media_status_ghost();
  return MEDIA_STATUS_META[status].label;
}

/**
 * What a library's works view shows while no status pill is picked: what's
 * still ahead. The finished and dropped show once their own pill is picked.
 * Music has no "in progress" (an album is heard or not, and heard again), so
 * it shows everything.
 */
export const LIBRARY_UNPICKED_STATUSES: Record<SavedViewDomain, string[]> = {
  MEDIA: [
    "WATCHING",
    "PLANNED",
    "DORMANT",
    "GHOST",
  ] satisfies MediaFilterStatus[],
  // Paused is a kind of playing/reading: listed so its pill sits with them.
  GAMES: ["BACKLOG", "PLAYING", SESSION_FILTER_PAUSED] satisfies (
    GameStatus | typeof SESSION_FILTER_PAUSED
  )[],
  BOOKS: ["TO_READ", "READING", SESSION_FILTER_PAUSED] satisfies (
    BookStatus | typeof SESSION_FILTER_PAUSED
  )[],
  MUSIC: [],
};
