import type { PileSummaryDto } from "@loomkeep/shared";

/** One entry's share of a pile; `amount` null means no data to count it with. */
export interface PileItem {
  amount: number | null;
  estimated: boolean;
}

/**
 * Statuses that make a pile: everything planned, plus what's in progress —
 * the rest of it, not all of it. Media's own pair lives in LibraryService,
 * where the effective status is derived rather than stored.
 */
export const GAME_PILE_STATUSES = ["BACKLOG", "PLAYING"] as const;
export const BOOK_PILE_STATUSES = ["TO_READ", "READING"] as const;
export const MUSIC_PILE_STATUSES = ["TO_LISTEN"] as const;

export function summarizePile(
  unit: PileSummaryDto["unit"],
  items: PileItem[],
): PileSummaryDto {
  const counted = items.filter(
    (item): item is { amount: number; estimated: boolean } =>
      item.amount !== null,
  );

  return {
    unit,
    amount: Math.round(counted.reduce((sum, item) => sum + item.amount, 0)),
    entries: items.length,
    counted: counted.length,
    estimated: counted.some((item) => item.estimated),
  };
}

/**
 * A game's remaining time, from IGDB's "normal" playthrough average. For a
 * game in progress it's what the player's own playtime leaves of it — used
 * only inside this total, never shown per game against their own pace.
 */
export function gamePileItem(
  status: string,
  normallyMin: number | null,
  playtimeMinutes: number,
): PileItem {
  if (normallyMin === null) return { amount: null, estimated: true };
  const amount =
    status === "PLAYING"
      ? Math.max(0, normallyMin - playtimeMinutes)
      : normallyMin;
  return { amount, estimated: true };
}

export function bookPileItem(
  pageCount: number | null,
  currentPage: number,
): PileItem {
  if (!pageCount) return { amount: null, estimated: false };
  return { amount: Math.max(0, pageCount - currentPage), estimated: false };
}
