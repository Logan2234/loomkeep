import { DATE_MEDIUM_OPTIONS, formatDate, formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";

// TMDB air dates are calendar days, stored at midnight UTC — read in UTC so
// they never slip to the day before west of Greenwich.
const DAY_UTC: Intl.DateTimeFormatOptions = {
  ...DATE_MEDIUM_OPTIONS,
  timeZone: "UTC",
};

export function airDateLabel(airDate: string): string {
  return formatDate(airDate, DAY_UTC);
}

/** "8,4" — scores on /10 keep one decimal. */
export const scoreLabel = (score: number) =>
  formatNumber(score, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Shown instead of the watch button while an episode hasn't aired: "Demain"
 * or "Dans 3 jours". Null once aired.
 */
export function upcomingLabel(
  airDate: string | null,
  now: Date,
): string | null {
  if (!airDate) return null;
  const air = new Date(airDate);
  if (air <= now) return null;

  const airDay = new Date(
    air.getUTCFullYear(),
    air.getUTCMonth(),
    air.getUTCDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((airDay.getTime() - today.getTime()) / 86_400_000);

  if (days <= 0) return null;
  return days === 1 ? m.common_tomorrow() : m.media_airing_in_days({ days });
}
