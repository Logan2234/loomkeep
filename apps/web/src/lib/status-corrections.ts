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
