import type { ReleaseDatePrecision } from "./enums";

/**
 * Not out yet: announced without a date, or its period hasn't begun. A game
 * dated "March 2027" counts as out from March 1st — held back to the 31st, a
 * game IGDB never dates more closely would stay locked while people play it.
 */
export function isGameUpcoming(
  releaseDate: string | null,
  precision: ReleaseDatePrecision | null,
  now = new Date(),
): boolean {
  if (precision === "TBD") return true;
  return releaseDate !== null && releaseDate > now.toISOString().slice(0, 10);
}

/**
 * The day a release reminder goes off, `YYYY-MM-DD`: only a day or a month
 * pins one down, a month on its 1st. A vaguer date waits for IGDB to narrow it.
 */
export function gameReleaseAlertDay(
  releaseDate: string | null,
  precision: ReleaseDatePrecision | null,
): string | null {
  return precision === "DAY" || precision === "MONTH" ? releaseDate : null;
}
