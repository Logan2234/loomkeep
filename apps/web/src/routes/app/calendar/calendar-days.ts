import { calendarDayIso } from "#lib/calendar-entry.js";
import { localDateInput } from "#lib/date.js";
import type { CalendarEntryDto } from "@loomkeep/shared";

export type CalendarFilter =
  "all" | "series" | "anime" | "movie" | "game" | "muted";

export function matchesFilter(
  entry: CalendarEntryDto,
  filter: CalendarFilter,
): boolean {
  switch (filter) {
    case "movie":
      return entry.mediaItem?.type === "MOVIE";
    case "series":
      return entry.mediaItem?.type === "SERIES";
    case "anime":
      return entry.mediaItem?.type === "ANIME";
    case "game":
      return entry.game !== null;
    case "muted":
      return entry.episodeAlertsMuted;
    default:
      return true;
  }
}

export interface CalendarDay {
  /** Stable across renders: the local date, `YYYY-MM-DD`. */
  key: string;
  /** Local midnight of that day. */
  date: Date;
  /** Days from today: 0 = today, 1 = tomorrow… */
  offset: number;
  items: CalendarEntryDto[];
}

/** Days shown even when empty, so the first week reads as a continuous run. */
export const WEEK_DAYS = 7;

/**
 * Which stretch a day falls in: the strip's seven days, the seven after them,
 * or anything later — a release a month off isn't "next week".
 */
export function calendarBand(offset: number): "week" | "nextWeek" | "later" {
  if (offset < WEEK_DAYS) return "week";
  return offset < 2 * WEEK_DAYS ? "nextWeek" : "later";
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Buckets the (date-sorted) entries by local day. The next {@link WEEK_DAYS}
 * days are always there, empty or not; later days only when something airs.
 */
export function groupByDay(
  entries: CalendarEntryDto[],
  now: Date = new Date(),
): CalendarDay[] {
  const today = startOfDay(now);
  const days = new Map<string, CalendarDay>();

  for (let offset = 0; offset < WEEK_DAYS; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    days.set(localDateInput(date), {
      key: localDateInput(date),
      date,
      offset,
      items: [],
    });
  }

  for (const entry of entries) {
    const date = startOfDay(new Date(calendarDayIso(entry)));
    const key = localDateInput(date);
    let day = days.get(key);

    if (!day) {
      // Rounded: a DST change makes one day 23 or 25 hours long.
      const offset = Math.round((date.getTime() - today.getTime()) / DAY_MS);
      day = { key, date, offset, items: [] };
      days.set(key, day);
    }

    day.items.push(entry);
  }

  return [...days.values()].sort((a, b) => a.offset - b.offset);
}
