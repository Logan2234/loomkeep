const DAY_MS = 86_400_000;

/**
 * Pace since the first activity in the last 30 calendar days, including idle
 * days through today. Three distinct active days are required for an estimate.
 */
export function estimateCompletionDate(
  remainingMinutes: number | null,
  activity: readonly { occurredAt: Date | string; minutes: number }[],
  timezone = "UTC",
  now = new Date(),
): string | null {
  if (remainingMinutes === null || remainingMinutes <= 0) return null;

  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    // User timezones are unvalidated; match the API's UTC fallback.
    return estimateCompletionDate(remainingMinutes, activity, "UTC", now);
  }

  const dayIndex = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((value) => value.type === type)!.value);
    return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
  };

  const today = dayIndex(now);
  const activeDays = new Set<number>();
  let minutes = 0;

  for (const sample of activity) {
    const occurredAt = new Date(sample.occurredAt);
    if (occurredAt > now || sample.minutes <= 0) continue;
    const day = dayIndex(occurredAt);
    if (day < today - 29) continue;
    activeDays.add(day);
    minutes += sample.minutes;
  }

  if (activeDays.size < 3) return null;

  const elapsedDays = today - Math.min(...activeDays) + 1;
  const daysLeft = Math.ceil((remainingMinutes * elapsedDays) / minutes);
  return new Date((today + daysLeft) * DAY_MS).toISOString().slice(0, 10);
}
