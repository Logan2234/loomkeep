import type { MediaDetailSeasonDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  defaultSeasonNumber,
  largeStill,
  runProgress,
  unwatchedGapCount,
} from "./episodes";

const NOW = new Date("2026-10-14T12:00:00Z");

function season(
  number: number,
  episodes: { watched?: boolean; airDate?: string | null }[],
): MediaDetailSeasonDto {
  return {
    number,
    episodes: episodes.map((e, i) => ({
      number: i + 1,
      watchCount: e.watched ? 1 : 0,
      airDate: e.airDate === undefined ? "2026-01-01T00:00:00Z" : e.airDate,
    })),
  } as MediaDetailSeasonDto;
}

describe("defaultSeasonNumber", () => {
  it("opens the season holding the next episode to watch", () => {
    const seasons = [
      season(1, [{ watched: true }, { watched: true }]),
      season(2, [{ watched: true }, {}, {}]),
      season(3, [{}]),
    ];
    expect(defaultSeasonNumber(seasons, NOW)).toBe(2);
  });

  it("opens nothing for a show not started yet", () => {
    expect(defaultSeasonNumber([season(1, [{}, {}])], NOW)).toBeNull();
  });

  it("opens nothing once everything aired has been watched", () => {
    const seasons = [
      season(1, [{ watched: true }, { watched: true }]),
      season(2, [{ watched: true }, { airDate: "2026-10-20T00:00:00Z" }]),
    ];
    expect(defaultSeasonNumber(seasons, NOW)).toBeNull();
  });

  it("leaves specials out of the run", () => {
    const seasons = [season(0, [{}]), season(1, [{ watched: true }])];
    expect(defaultSeasonNumber(seasons, NOW)).toBeNull();
  });
});

describe("runProgress", () => {
  it("counts watched and aired episodes of the regular run", () => {
    const seasons = [
      season(0, [{ watched: true }]),
      season(1, [{ watched: true }, {}, { airDate: "2027-01-01T00:00:00Z" }]),
    ];
    expect(runProgress(seasons, NOW)).toEqual({ watched: 1, aired: 2 });
  });
});

describe("unwatchedGapCount", () => {
  it("counts the earlier unwatched regular episodes only", () => {
    const seasons = [
      season(0, [{}]),
      season(1, [{ watched: true }, {}]),
      season(2, [{}, {}]),
    ];
    expect(unwatchedGapCount(seasons, 2, 2)).toBe(2);
    expect(unwatchedGapCount(seasons, 0, 1)).toBe(0);
  });
});

describe("largeStill", () => {
  it("asks TMDB for a larger size, and leaves other hosts alone", () => {
    expect(largeStill("https://image.tmdb.org/t/p/w300/a.jpg")).toBe(
      "https://image.tmdb.org/t/p/w780/a.jpg",
    );
    expect(largeStill("https://img1.ak.crunchyroll.com/i/a_full.jpg")).toBe(
      "https://img1.ak.crunchyroll.com/i/a_full.jpg",
    );
  });
});
