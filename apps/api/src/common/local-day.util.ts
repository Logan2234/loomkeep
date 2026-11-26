import { utcDateKey, utcYearRange } from "./date.util";

/**
 * Local-timezone helpers built on `Intl.DateTimeFormat`, shared by anything
 * that needs to reason about "today" or "this hour" from the user's own
 * point of view rather than the server's UTC clock. `User.timezone` is a
 * free-form IANA string, deliberately unvalidated at write time (see
 * `update-user.dto.ts`) — every function here guards with try/catch and
 * returns null for an invalid zone rather than throwing, so a bad value
 * degrades a feature instead of crashing a request or a cron job.
 */

/** Local hour (0-23) and abbreviated weekday ("Mon", "Tue"…) in `timezone`, or null if it's not a valid IANA zone. */
export function localParts(
  timezone: string,
  date: Date,
): { hour: number; weekday: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(date);
    const hourStr = parts.find((p) => p.type === "hour")?.value;
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    if (!hourStr || !weekday) return null;
    // Some ICU builds render local midnight as "24" with hour12:false.
    return { hour: Number(hourStr) % 24, weekday };
  } catch {
    return null;
  }
}

/**
 * Local calendar day ("YYYY-MM-DD") in `timezone`, or null if it's not a
 * valid IANA zone. Used to key daily caps/quotas (see `XpService.award`) by
 * the user's own day boundary rather than the server's UTC one — someone in
 * UTC+14 shouldn't have their daily XP cap reset at their 2pm.
 */
export function localDay(timezone: string, date: Date): string | null {
  try {
    // en-CA formats numeric dates as YYYY-MM-DD, so the parts can be joined
    // in source order without reassembling them by type.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

export function localDayOrUtc(timezone: string, date: Date): string {
  return localDay(timezone, date) ?? utcDateKey(date);
}

/** How far `timezone` runs ahead of UTC at `at`, in milliseconds. */
function offsetMs(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant the user's current day began, midnight in `timezone` — UTC
 * midnight for an invalid zone, like `localDayOrUtc`. What "from today"
 * means for someone whose evening is already tomorrow in UTC.
 */
export function startOfLocalDay(timezone: string, at: Date): Date {
  const day = localDay(timezone, at);
  if (!day) return new Date(`${utcDateKey(at)}T00:00:00.000Z`);
  return localMidnight(timezone, day);
}

/** Midnight of the calendar day `day` ("YYYY-MM-DD") in a valid `timezone`. */
function localMidnight(timezone: string, day: string): Date {
  const midnightUtc = Date.parse(`${day}T00:00:00.000Z`);
  // Two passes: the offset at UTC midnight can differ from the one at local
  // midnight when a DST change falls in between.
  let start = midnightUtc - offsetMs(timezone, new Date(midnightUtc));
  start = midnightUtc - offsetMs(timezone, new Date(start));
  return new Date(start);
}

/** The year `date` falls in for someone in `timezone` (UTC for an invalid zone). */
export function localYear(timezone: string, date: Date): number {
  return Number(localDayOrUtc(timezone, date).slice(0, 4));
}

/**
 * The instants bounding `year` in `timezone`, from its new year's midnight
 * to the next — the UTC year for an invalid zone.
 */
export function localYearRange(
  timezone: string,
  year: number,
): { gte: Date; lt: Date } {
  if (localDay(timezone, new Date()) === null) return utcYearRange(year);
  return {
    gte: localMidnight(timezone, `${year}-01-01`),
    lt: localMidnight(timezone, `${year + 1}-01-01`),
  };
}
