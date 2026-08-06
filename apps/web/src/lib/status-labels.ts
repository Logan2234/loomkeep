// Shared status labels/order and detail-page styling for books and games, so
// the same constants aren't retyped across list, detail, import and stats pages.
// (Media entry statuses are server-derived and handled separately.)

import type { BookStatus, GameStatus, MusicStatus } from "@loomkeep/shared";

// --- Books ---

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  TO_READ: "À lire",
  READING: "En lecture",
  READ: "Lu",
  DROPPED: "Abandonné",
};

export const BOOK_STATUS_ORDER: BookStatus[] = [
  "TO_READ",
  "READING",
  "READ",
  "DROPPED",
];

// Status badge: label + chip styling (neutral / accent / success / danger).
export const BOOK_STATUS_META: Record<
  BookStatus,
  { label: string; cls: string }
> = {
  TO_READ: { label: "À lire", cls: "bg-surface-2 text-dim" },
  READING: { label: "En lecture", cls: "bg-accent text-accent-fg" },
  READ: { label: "Lu", cls: "bg-success/15 text-success" },
  DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
};

// Surfaced as a tooltip on the status badge / segments.
export const BOOK_STATUS_DESC: Record<BookStatus, string> = {
  TO_READ: "Dans ta pile, pas encore commencé.",
  READING: "Tu lis ce livre en ce moment.",
  READ: "Tu as terminé ce livre.",
  DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
};

// Active-segment styling for the segmented status control.
export const BOOK_STATUS_SEG_ACTIVE: Record<BookStatus, string> = {
  TO_READ: "bg-surface text-fg shadow-sm",
  READING: "bg-accent text-accent-fg",
  READ: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

// --- Games ---

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  BACKLOG: "À jouer",
  PLAYING: "En cours",
  COMPLETED: "Terminé",
  DROPPED: "Abandonné",
};

export const GAME_STATUS_ORDER: GameStatus[] = [
  "BACKLOG",
  "PLAYING",
  "COMPLETED",
  "DROPPED",
];

// Status badge: label + chip styling (neutral / accent / success / danger).
export const GAME_STATUS_META: Record<
  GameStatus,
  { label: string; cls: string }
> = {
  BACKLOG: { label: "À jouer", cls: "bg-surface-2 text-dim" },
  PLAYING: { label: "En cours", cls: "bg-accent text-accent-fg" },
  COMPLETED: { label: "Terminé", cls: "bg-success/15 text-success" },
  DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
};

// Surfaced as a tooltip on the status badge / segments.
export const GAME_STATUS_DESC: Record<GameStatus, string> = {
  BACKLOG: "Dans ta pile, pas encore commencé.",
  PLAYING: "Tu joues à ce jeu en ce moment.",
  COMPLETED: "Tu as fini ce jeu.",
  DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
};

// Active-segment styling for the segmented status control.
export const GAME_STATUS_SEG_ACTIVE: Record<GameStatus, string> = {
  BACKLOG: "bg-surface text-fg shadow-sm",
  PLAYING: "bg-accent text-accent-fg",
  COMPLETED: "bg-success/20 text-success",
  DROPPED: "text-danger shadow-[inset_0_0_0_1px_var(--color-danger)]",
};

// --- Music ---
// Deliberately binary (no "in progress"/"dropped") — an album listen is a
// short, single-session event, unlike a book or a game.

export const MUSIC_STATUS_LABELS: Record<MusicStatus, string> = {
  TO_LISTEN: "À écouter",
  LISTENED: "Écouté",
};

export const MUSIC_STATUS_ORDER: MusicStatus[] = ["TO_LISTEN", "LISTENED"];

// Status badge: label + chip styling (neutral / success).
export const MUSIC_STATUS_META: Record<
  MusicStatus,
  { label: string; cls: string }
> = {
  TO_LISTEN: { label: "À écouter", cls: "bg-surface-2 text-dim" },
  LISTENED: { label: "Écouté", cls: "bg-success/15 text-success" },
};

// Surfaced as a tooltip on the status badge / segments.
export const MUSIC_STATUS_DESC: Record<MusicStatus, string> = {
  TO_LISTEN: "Dans ta liste, pas encore écouté.",
  LISTENED: "Tu as écouté cet album.",
};

// Active-segment styling for the segmented status control.
export const MUSIC_STATUS_SEG_ACTIVE: Record<MusicStatus, string> = {
  TO_LISTEN: "bg-surface text-fg shadow-sm",
  LISTENED: "bg-success/20 text-success",
};
