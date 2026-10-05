/** An ISO date string to a `Date`, passing `null` through unchanged. */
export function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function utcYearRange(year: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export function utcMonthRange(date: Date): { gte: Date; lt: Date } {
  return {
    gte: startOfUtcMonth(date),
    lt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
  };
}

/** Shift by fixed 24-hour spans, preserving the reference instant's time of day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function sinceDaysAgo(now: Date, days: number): Date {
  return addDays(now, -days);
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
