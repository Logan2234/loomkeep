import { m } from "#lib/paraglide/messages.js";
import type { BookStatus, GameStatus } from "@loomkeep/shared";

export const BOOK_DIRECT_STATUS_TARGETS: Partial<
  Record<BookStatus, readonly BookStatus[]>
> = {
  READING: ["READ", "DROPPED"],
  DROPPED: ["READING"],
};

export const GAME_DIRECT_STATUS_TARGETS: Partial<
  Record<GameStatus, readonly GameStatus[]>
> = {
  PLAYING: ["COMPLETED", "DROPPED"],
  DROPPED: ["PLAYING"],
};

export function getStatusCorrections<T extends string>(
  statuses: readonly T[],
  current: T,
  directTargets: readonly T[] = [],
): T[] {
  return statuses.filter(
    (status) => status !== current && !directTargets.includes(status),
  );
}

/**
 * The "…" entry correcting the status: named after the only correction left,
 * or opening the editor for several — and none when nothing is left to
 * correct (a game in progress with sessions can't return to the backlog).
 */
export function statusCorrectionLabel(
  corrections: readonly string[],
  singleLabel: string,
): string | null {
  if (corrections.length === 0) return null;
  return corrections.length === 1 ? singleLabel : m.tracking_correct_status();
}
