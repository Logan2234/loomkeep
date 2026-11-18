import type { PremiereDto } from "@loomkeep/shared";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
// Weekly rails cover the first four weeks; TMDB dates the later premieres
// as they get announced, too few a week to fill a rail of their own.
const WEEKLY_RAILS = 4;

export type PremiereRailKind = "thisWeek" | "nextWeek" | "week" | "month";

export interface PremiereRail {
  key: string;
  kind: PremiereRailKind;
  /** Local midnight of the rail's first day (a month's first, for "month"). */
  from: Date;
  /** Local midnight of the rail's last day; null for a month. */
  to: Date | null;
  items: PremiereDto[];
}

export interface PremiereSchedule {
  today: PremiereDto[];
  rails: PremiereRail[];
}

/** A `YYYY-MM-DD` read as local midnight, not UTC's. */
export const premiereDay = (p: PremiereDto) =>
  new Date(`${p.firstAirDate}T00:00:00`);

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Days from today; rounded, as a DST change makes a day 23 or 25 hours. */
export function premiereOffset(p: PremiereDto, now: Date): number {
  return Math.round(
    (premiereDay(p).getTime() - startOfDay(now).getTime()) / DAY_MS,
  );
}

/**
 * Today's premieres, then one rail per week over the four weeks after today
 * (empty weeks left out) and one per month beyond. The premieres come sorted.
 */
export function groupPremieres(
  premieres: PremiereDto[],
  now: Date,
): PremiereSchedule {
  const today = startOfDay(now);
  const schedule: PremiereSchedule = { today: [], rails: [] };
  const byKey = new Map<string, PremiereRail>();

  for (const p of premieres) {
    const offset = premiereOffset(p, now);
    if (offset < 0) continue;

    if (offset === 0) {
      schedule.today.push(p);
      continue;
    }

    const week = Math.floor((offset - 1) / WEEK_DAYS);
    let key: string;
    let make: () => PremiereRail;

    if (week < WEEKLY_RAILS) {
      key = `week-${week}`;
      make = () => ({
        key,
        kind: week === 0 ? "thisWeek" : week === 1 ? "nextWeek" : "week",
        from: addDays(today, 1 + week * WEEK_DAYS),
        to: addDays(today, (week + 1) * WEEK_DAYS),
        items: [],
      });
    } else {
      const day = premiereDay(p);
      key = `month-${p.firstAirDate.slice(0, 7)}`;
      make = () => ({
        key,
        kind: "month",
        from: new Date(day.getFullYear(), day.getMonth(), 1),
        to: null,
        items: [],
      });
    }

    let rail = byKey.get(key);

    if (!rail) {
      rail = make();
      byKey.set(key, rail);
      schedule.rails.push(rail);
    }

    rail.items.push(p);
  }

  return schedule;
}

/**
 * The week's most awaited premiere, by TMDB popularity, among those with an
 * image wide enough for the banner and a synopsis to show on it.
 */
export function pickHeadliner(
  premieres: PremiereDto[],
  now: Date,
): PremiereDto | null {
  let best: PremiereDto | null = null;

  for (const p of premieres) {
    const offset = premiereOffset(p, now);
    if (offset < 0 || offset >= WEEK_DAYS) continue;
    if (!p.backdropUrl || !p.overview) continue;
    if (!best || p.popularity > best.popularity) best = p;
  }

  return best;
}
