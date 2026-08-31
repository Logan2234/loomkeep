import { m } from "$lib/paraglide/messages";
import type { BookStatus, GameStatus, MusicStatus } from "@loomkeep/shared";

// --- Books ---

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  TO_READ: m.book_status_to_read(),
  READING: m.book_status_reading(),
  READ: m.book_status_read(),
  DROPPED: m.library_status_dropped(),
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
  TO_READ: { label: m.book_status_to_read(), cls: "bg-surface-2 text-dim" },
  READING: { label: m.book_status_reading(), cls: "bg-accent text-accent-fg" },
  READ: { label: m.book_status_read(), cls: "bg-success/15 text-success" },
  DROPPED: {
    label: m.library_status_dropped(),
    cls: "border border-danger text-danger",
  },
};

export const BOOK_STATUS_DESC: Record<BookStatus, string> = {
  TO_READ: m.library_status_backlog_description(),
  READING: m.book_status_reading_description(),
  READ: m.book_status_read_description(),
  DROPPED: m.library_status_dropped_description(),
};

export const BOOK_STATUS_SEG_ACTIVE: Record<BookStatus, string> = {
  TO_READ: "bg-surface text-fg shadow-sm",
  READING: "bg-accent text-accent-fg",
  READ: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

// --- Games ---

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  BACKLOG: m.game_status_backlog(),
  PLAYING: m.game_status_playing(),
  COMPLETED: m.game_status_completed(),
  DROPPED: m.library_status_dropped(),
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
  BACKLOG: { label: m.game_status_backlog(), cls: "bg-surface-2 text-dim" },
  PLAYING: { label: m.game_status_playing(), cls: "bg-accent text-accent-fg" },
  COMPLETED: {
    label: m.game_status_completed(),
    cls: "bg-success/15 text-success",
  },
  DROPPED: {
    label: m.library_status_dropped(),
    cls: "border border-danger text-danger",
  },
};

export const GAME_STATUS_DESC: Record<GameStatus, string> = {
  BACKLOG: m.library_status_backlog_description(),
  PLAYING: m.game_status_playing_description(),
  COMPLETED: m.game_status_completed_description(),
  DROPPED: m.library_status_dropped_description(),
};

export const GAME_STATUS_SEG_ACTIVE: Record<GameStatus, string> = {
  BACKLOG: "bg-surface text-fg shadow-sm",
  PLAYING: "bg-accent text-accent-fg",
  COMPLETED: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

// --- Music ---

export const MUSIC_STATUS_LABELS: Record<MusicStatus, string> = {
  TO_LISTEN: m.music_status_to_listen(),
  LISTENED: m.music_status_listened(),
};

export const MUSIC_STATUS_ORDER: MusicStatus[] = ["TO_LISTEN", "LISTENED"];

export const MUSIC_STATUS_META: Record<
  MusicStatus,
  { label: string; cls: string }
> = {
  TO_LISTEN: {
    label: m.music_status_to_listen(),
    cls: "bg-surface-2 text-dim",
  },
  LISTENED: {
    label: m.music_status_listened(),
    cls: "bg-success/15 text-success",
  },
};

export const MUSIC_STATUS_DESC: Record<MusicStatus, string> = {
  TO_LISTEN: m.music_status_to_listen_description(),
  LISTENED: m.music_status_listened_description(),
};

export const MUSIC_STATUS_SEG_ACTIVE: Record<MusicStatus, string> = {
  TO_LISTEN: "bg-surface text-fg shadow-sm",
  LISTENED: "bg-success/20 text-success",
};
