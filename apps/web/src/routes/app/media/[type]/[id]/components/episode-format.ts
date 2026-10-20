import { DATE_MEDIUM_OPTIONS, formatDate, formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";

// TMDB air dates are calendar days, stored at midnight UTC — read in UTC so
// they never slip to the day before west of Greenwich. Anime ones are exact
// broadcast times (AniList's airing schedule), read in the viewer's zone.
const DAY_UTC: Intl.DateTimeFormatOptions = {
  ...DATE_MEDIUM_OPTIONS,
  timeZone: "UTC",
};
const BROADCAST: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};
const BROADCAST_LONG: Intl.DateTimeFormatOptions = {
  ...BROADCAST,
  year: "numeric",
};

export function airDateLabel(
  airDate: string,
  exactTime: boolean,
  long = false,
): string {
  if (!exactTime) return formatDate(airDate, DAY_UTC);
  return formatDate(airDate, long ? BROADCAST_LONG : BROADCAST);
}

/** "8,4" — scores on /10 keep one decimal. */
export const scoreLabel = (score: number) =>
  formatNumber(score, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Shown instead of the watch button while an episode hasn't aired: "Demain",
 * "Dans 3 jours", or the time for one airing later today. Null once aired.
 */
export function upcomingLabel(
  airDate: string | null,
  now: Date,
  exactTime: boolean,
): string | null {
  if (!airDate) return null;
  const air = new Date(airDate);
  if (air <= now) return null;

  const airDay = exactTime
    ? new Date(air.getFullYear(), air.getMonth(), air.getDate())
    : new Date(air.getUTCFullYear(), air.getUTCMonth(), air.getUTCDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((airDay.getTime() - today.getTime()) / 86_400_000);

  if (days <= 0) {
    return exactTime
      ? formatDate(airDate, { hour: "2-digit", minute: "2-digit" })
      : null;
  }

  return days === 1 ? m.common_tomorrow() : m.media_airing_in_days({ days });
}
