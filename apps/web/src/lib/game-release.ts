import { formatDate, MONTH_YEAR_OPTIONS } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import type { ReleaseDatePrecision } from "@loomkeep/shared";

/**
 * "Sortie prévue le 19/11/2026", "… en mars 2027", "… au T4 2027", "… en
 * 2028": the upcoming release as precisely as IGDB knows it. Null when the
 * source dates no release at all.
 */
export function gameReleaseLabel(
  releaseDate: string | null,
  precision: ReleaseDatePrecision | null,
): string | null {
  if (precision === "TBD") return m.game_release_tbd();
  if (!releaseDate) return null;
  // Noon, so the day doesn't slip in a timezone west of UTC.
  const date = `${releaseDate.slice(0, 10)}T12:00:00`;
  const year = Number(releaseDate.slice(0, 4));

  switch (precision) {
    case "MONTH":
      return m.game_release_month({
        month: formatDate(date, MONTH_YEAR_OPTIONS),
      });
    case "QUARTER":
      return m.game_release_quarter({
        quarter: Math.floor(Number(releaseDate.slice(5, 7)) / 3) + 1,
        year,
      });
    case "YEAR":
      return m.game_release_year({ year });
    default:
      return `${m.media_release_expected()} ${formatDate(date)}`;
  }
}

/** A reminder set on a vaguer date waits for IGDB to name a day or a month. */
export const isVagueRelease = (precision: ReleaseDatePrecision | null) =>
  precision === "QUARTER" || precision === "YEAR" || precision === "TBD";
