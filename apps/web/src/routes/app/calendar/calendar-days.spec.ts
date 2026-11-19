import type { CalendarEntryDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  type CalendarFilter,
  calendarBand,
  groupByDay,
  matchesFilter,
  matchesFilters,
  WEEK_DAYS,
} from "./calendar-days";

// Local noon, far from midnight so no timezone pushes it to another day.
const NOW = new Date(2026, 8, 27, 12, 0, 0);

function entry(
  airDate: Date,
  overrides: Partial<CalendarEntryDto> = {},
): CalendarEntryDto {
  return {
    mediaItem: {
      id: "m1",
      type: "SERIES",
      title: "Lanterns",
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: "1",
    },
    game: null,
    entryId: "e1",
    episodeAlertsMuted: false,
    episodesBehind: 0,
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: null,
    airDate: airDate.toISOString(),
    ...overrides,
  };
}

const at = (dayOffset: number, hour = 20) =>
  new Date(2026, 8, 27 + dayOffset, hour, 0, 0);

describe("groupByDay", () => {
  it("always lays out the coming week, empty days included", () => {
    const days = groupByDay([], NOW);

    expect(days).toHaveLength(WEEK_DAYS);
    expect(days.map((d) => d.offset)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days[0].key).toBe("2026-09-27");
    expect(days[6].key).toBe("2026-10-03");
  });

  it("buckets entries by local day, in order", () => {
    const a = entry(at(0, 9));
    const b = entry(at(0, 22));
    const c = entry(at(2));
    const days = groupByDay([a, b, c], NOW);

    expect(days[0].items).toEqual([a, b]);
    expect(days[1].items).toEqual([]);
    expect(days[2].items).toEqual([c]);
  });

  it("adds a later day only when something airs on it", () => {
    const later = entry(at(9));
    const days = groupByDay([later], NOW);

    expect(days).toHaveLength(WEEK_DAYS + 1);
    expect(days.at(-1)).toMatchObject({ offset: 9, items: [later] });
  });
});

describe("calendarBand", () => {
  it("calls only the seven days after the strip next week", () => {
    expect(calendarBand(6)).toBe("week");
    expect(calendarBand(7)).toBe("nextWeek");
    expect(calendarBand(13)).toBe("nextWeek");
    expect(calendarBand(46)).toBe("later");
  });
});

describe("matchesFilter", () => {
  const series = entry(at(1));
  const anime = entry(at(1), {
    mediaItem: { ...series.mediaItem!, type: "ANIME" },
  });
  const muted = entry(at(1), { episodeAlertsMuted: true });

  it("splits series from anime", () => {
    expect(matchesFilter(series, "series")).toBe(true);
    expect(matchesFilter(anime, "series")).toBe(false);
    expect(matchesFilter(anime, "anime")).toBe(true);
  });

  it("keeps only muted shows under the muted filter", () => {
    expect(matchesFilter(muted, "muted")).toBe(true);
    expect(matchesFilter(series, "muted")).toBe(false);
  });
});

describe("matchesFilters", () => {
  const series = entry(at(1));
  const anime = entry(at(1), {
    mediaItem: { ...series.mediaItem!, type: "ANIME" },
  });
  const muted = entry(at(1), { episodeAlertsMuted: true });
  const kept = (selected: CalendarFilter[]) =>
    [series, anime, muted].filter((e) => matchesFilters(e, new Set(selected)));

  it("keeps everything with no chip on", () => {
    expect(kept([])).toEqual([series, anime, muted]);
  });

  it("adds the kinds up", () => {
    expect(kept(["series", "anime"])).toEqual([series, anime, muted]);
    expect(kept(["anime"])).toEqual([anime]);
  });

  it("narrows the kinds kept to muted shows", () => {
    expect(kept(["muted"])).toEqual([muted]);
    expect(kept(["anime", "muted"])).toEqual([]);
  });
});
