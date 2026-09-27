import { describe, expect, it } from "vitest";
import { m } from "./paraglide/messages.js";
import { overwriteGetLocale } from "./paraglide/runtime.js";
import { pileHeaderLabel, pileTile, timeLeftToWatch } from "./pile";

overwriteGetLocale(() => "fr");

describe("pileHeaderLabel", () => {
  it("rounds video time to hours, with no coverage since defaults stand in", () => {
    expect(
      pileHeaderLabel("MEDIA", {
        unit: "MINUTES",
        amount: 18_720,
        entries: 87,
        counted: 87,
        estimated: false,
      }),
    ).toBe(m.pile_to_watch({ amount: "312 h" }));
  });

  it("marks an estimate and says how much of the pile it covers", () => {
    expect(
      pileHeaderLabel("GAMES", {
        unit: "MINUTES",
        amount: 38_400,
        entries: 92,
        counted: 65,
        estimated: true,
      }),
    ).toBe(
      `${m.pile_to_play({ amount: "~640 h" })} · ${m.pile_coverage_games({ pct: 71 })}`,
    );
  });

  it("shows nothing once the pile is empty or has no figure at all", () => {
    const empty = {
      unit: "PAGES" as const,
      amount: 0,
      entries: 4,
      counted: 4,
      estimated: false,
    };
    expect(pileHeaderLabel("BOOKS", empty)).toBeNull();
    expect(pileHeaderLabel("BOOKS", { ...empty, counted: 0 })).toBeNull();
  });
});

describe("pileTile", () => {
  it("sets the unit apart and falls back to the entry count as its hint", () => {
    expect(
      pileTile("MUSIC", {
        unit: "MINUTES",
        amount: 1080,
        entries: 24,
        counted: 24,
        estimated: false,
      }),
    ).toEqual({
      value: "18",
      unit: " h",
      label: m.pile_tile_to_listen(),
      hint: m.music_library_count_many({ count: 24 }),
    });
  });
});

describe("timeLeftToWatch", () => {
  const NOW = new Date("2026-09-27T12:00:00Z");
  const episode = (
    number: number,
    runtimeMin: number | null,
    watchCount = 0,
    airDate: string | null = "2026-01-01",
  ) => ({
    id: `e${number}`,
    number,
    title: null,
    airDate,
    runtimeMin,
    watchCount,
    watches: [],
  });

  it("times the aired, unwatched episodes, specials aside", () => {
    const left = timeLeftToWatch(
      "SERIES",
      45,
      [
        { id: "s0", number: 0, title: null, episodes: [episode(1, 90)] },
        {
          id: "s1",
          number: 1,
          title: null,
          episodes: [
            episode(1, 48, 1),
            episode(2, 47),
            episode(3, 40),
            episode(4, 40, 0, "2026-12-01"),
          ],
        },
      ],
      NOW,
    );

    expect(left).toEqual({ minutes: 87, estimated: false });
  });

  it("falls back like the stats do, and flags it", () => {
    const left = timeLeftToWatch(
      "ANIME",
      null,
      [{ id: "s1", number: 1, title: null, episodes: [episode(1, null)] }],
      NOW,
    );

    expect(left).toEqual({ minutes: 24, estimated: true });
  });

  it("is null once everything aired has been watched", () => {
    expect(
      timeLeftToWatch(
        "SERIES",
        45,
        [{ id: "s1", number: 1, title: null, episodes: [episode(1, 45, 1)] }],
        NOW,
      ),
    ).toBeNull();
  });
});
