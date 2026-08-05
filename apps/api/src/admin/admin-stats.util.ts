import type { TrendPeriod, TrendPointDto } from "@tracklore/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many buckets each period spans. */
export const TREND_BUCKETS: Record<TrendPeriod, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 5,
};

/** Start of `d`'s UTC day — the boundary every daily bucket/counter uses. */
export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Ascending UTC bucket-start dates for the period, the last one being the
 * bucket `now` falls in. Day/week use fixed spans; month/year use calendar
 * boundaries (so months of unequal length and leap years bucket correctly).
 */
export function trendBucketStarts(period: TrendPeriod, now: Date): Date[] {
  const n = TREND_BUCKETS[period];
  const starts: Date[] = [];

  if (period === "day" || period === "week") {
    const span = period === "day" ? DAY_MS : 7 * DAY_MS;
    const base = startOfUtcDay(now).getTime();
    for (let i = n - 1; i >= 0; i--) starts.push(new Date(base - i * span));
  } else if (period === "month") {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    for (let i = n - 1; i >= 0; i--)
      starts.push(new Date(Date.UTC(y, m - i, 1)));
  } else {
    const y = now.getUTCFullYear();
    for (let i = n - 1; i >= 0; i--)
      starts.push(new Date(Date.UTC(y - i, 0, 1)));
  }

  return starts;
}

/** Index of the last bucket whose start is ≤ `t`, or -1 when `t` predates the window. */
function bucketIndex(starts: Date[], t: number): number {
  let idx = -1;

  for (let i = 0; i < starts.length; i++) {
    if (starts[i].getTime() <= t) idx = i;
    else break;
  }

  return idx;
}

/** Counts `dates` into the buckets defined by `starts`; dates before the window are dropped. */
export function bucketize(dates: Date[], starts: Date[]): TrendPointDto[] {
  const counts = new Array<number>(starts.length).fill(0);

  for (const d of dates) {
    const idx = bucketIndex(starts, d.getTime());
    if (idx >= 0) counts[idx]++;
  }

  return starts.map((s, i) => ({
    periodStart: s.toISOString(),
    count: counts[i],
  }));
}

/** Same buckets as {@link bucketize}, but running totals starting from `baseline`. */
export function cumulativeBucketize(
  dates: Date[],
  starts: Date[],
  baseline: number,
): TrendPointDto[] {
  let running = baseline;
  return bucketize(dates, starts).map((p) => {
    running += p.count;
    return { periodStart: p.periodStart, count: running };
  });
}
