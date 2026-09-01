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
