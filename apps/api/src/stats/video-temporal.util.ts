import type {
  HeatmapDayDto,
  HourCountDto,
  MonthCountDto,
  MonthMinutesDto,
  StatsWindow,
  WeekdayCountDto,
  YearMinutesDto,
} from "@loomkeep/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cutoff date for a rolling window, or null for "ALL" (no filter). */
export function windowStart(period: StatsWindow, now: Date): Date | null {
  switch (period) {
    case "WEEK":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "MONTH":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "YEAR":
      return new Date(now.getTime() - 365 * DAY_MS);
    case "ALL":
      return null;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM" (UTC) — the key both monthly bucketings below group on. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Keys of the last `months` calendar months, ending with `now`'s, oldest first. */
function lastMonthKeys(months: number, now: Date): string[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return Array.from({ length: months }, (_, i) =>
    monthKey(new Date(Date.UTC(year, month - (months - 1 - i), 1))),
  );
}

/** Daily watch counts for the last `days` days ending today, zero-filled. */
export function computeHeatmap(
  watchedAt: Date[],
  days = 365,
  now: Date = new Date(),
): HeatmapDayDto[] {
  const counts = new Map<string, number>();
  const start = new Date(now.getTime() - (days - 1) * DAY_MS);
  // Compare calendar dates, not exact timestamps — a watch later in the same
  // day as `now` must still count, regardless of `now`'s own time-of-day.
  const startDate = isoDate(start);
  const endDate = isoDate(now);

  for (const d of watchedAt) {
    const key = isoDate(d);
    if (key < startDate || key > endDate) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: HeatmapDayDto[] = [];

  for (let i = 0; i < days; i++) {
    const date = isoDate(new Date(start.getTime() + i * DAY_MS));
    result.push({ date, count: counts.get(date) ?? 0 });
  }

  return result;
}

/** 7 zero-filled buckets, Sunday=0 (UTC). */
export function computeWeekdayCounts(watchedAt: Date[]): WeekdayCountDto[] {
  const counts = new Array<number>(7).fill(0);
  for (const d of watchedAt) counts[d.getUTCDay()]++;
  return counts.map((count, weekday) => ({ weekday, count }));
}

/** 24 zero-filled buckets (UTC hour). */
export function computeHourCounts(watchedAt: Date[]): HourCountDto[] {
  const counts = new Array<number>(24).fill(0);
  for (const d of watchedAt) counts[d.getUTCHours()]++;
  return counts.map((count, hour) => ({ hour, count }));
}

export interface DatedMinutes {
  watchedAt: Date;
  minutes: number;
}

/** Last `months` calendar months ending with the current one, zero-filled. */
export function computeMonthlyMinutes(
  rows: DatedMinutes[],
  months = 12,
  now: Date = new Date(),
): MonthMinutesDto[] {
  const byMonth = new Map<string, number>();

  for (const r of rows) {
    const key = monthKey(r.watchedAt);
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.minutes);
  }

  return lastMonthKeys(months, now).map((month) => ({
    month,
    minutes: byMonth.get(month) ?? 0,
  }));
}

// Same last-N-months zero-filled bucketing as {@link computeMonthlyMinutes},
// generalised to a plain event count — used by the social temporal panels
// (new followers/month, reviews+comments/month), where there's no "minutes"
// to sum.
export function computeMonthlyCounts(
  dates: Date[],
  months = 12,
  now: Date = new Date(),
): MonthCountDto[] {
  const byMonth = new Map<string, number>();

  for (const d of dates) {
    const key = monthKey(d);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  return lastMonthKeys(months, now).map((month) => ({
    month,
    count: byMonth.get(month) ?? 0,
  }));
}

/** Every calendar year with activity, ascending. */
export function computeYearlyMinutes(rows: DatedMinutes[]): YearMinutesDto[] {
  const byYear = new Map<number, number>();

  for (const r of rows) {
    const year = r.watchedAt.getUTCFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + r.minutes);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, minutes]) => ({ year, minutes }));
}

/** The year with the most minutes, or null when there's no activity. */
export function mostActiveYear(yearly: YearMinutesDto[]): number | null {
  if (yearly.length === 0) return null;
  return yearly.reduce((best, y) => (y.minutes > best.minutes ? y : best)).year;
}

/**
 * Consecutive days, ending today or yesterday, with at least one watch.
 * Today not having a watch yet doesn't break the streak (you might still
 * watch something before the day is over) — but two missed days does.
 */
export function computeStreak(
  watchedAt: Date[],
  now: Date = new Date(),
): number {
  const days = new Set(watchedAt.map(isoDate));
  let cursor = new Date(now);
  if (!days.has(isoDate(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);

  let streak = 0;

  while (days.has(isoDate(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return streak;
}

// Batches {@link computeStreak} per user — one row set covering many users,
// for the small streak badge shown next to a pseudo in reviews/comments.
export function computeStreaksByUser(
  watches: { userId: string; watchedAt: Date }[],
  now: Date = new Date(),
): Map<string, number> {
  const byUser = new Map<string, Date[]>();

  for (const w of watches) {
    const arr = byUser.get(w.userId) ?? [];
    arr.push(w.watchedAt);
    byUser.set(w.userId, arr);
  }

  const result = new Map<string, number>();

  for (const [userId, dates] of byUser) {
    result.set(userId, computeStreak(dates, now));
  }

  return result;
}
