import { describe, expect, it } from "vitest";
import {
  baseTitle,
  type DatedSeason,
  findAnchors,
  mapEpisodes,
  mergeStatus,
  titlesMatch,
} from "./anime-migration.util";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** One-Punch Man as TMDB files it: seasons 1 and 2, 3 episodes each here. */
const opm: DatedSeason[] = [
  {
    number: 0,
    episodes: [{ number: 1, airDate: day("2016-03-31") }],
  },
  {
    number: 1,
    episodes: [
      { number: 1, airDate: day("2015-10-05") },
      { number: 2, airDate: day("2015-10-12") },
      { number: 3, airDate: day("2015-10-19") },
    ],
  },
  {
    number: 2,
    episodes: [
      { number: 1, airDate: day("2019-04-10") },
      { number: 2, airDate: day("2019-04-17") },
      { number: 3, airDate: day("2019-04-24") },
    ],
  },
];

describe("titlesMatch", () => {
  it("matches a sequel's title to the show's once its suffix is cut", () => {
    expect(titlesMatch(["One Punch Man Season 2"], ["One-Punch Man"])).toBe(
      true,
    );
    expect(
      titlesMatch(
        ["Shingeki no Kyojin: The Final Season"],
        ["Shingeki no Kyojin"],
      ),
    ).toBe(true);
    expect(titlesMatch(["ワンパンマン 第2期"], ["ワンパンマン"])).toBe(true);
  });

  it("rejects an unrelated show", () => {
    expect(titlesMatch(["Frieren"], ["One-Punch Man"])).toBe(false);
  });

  it("keeps a numbered title whole as well as cut", () => {
    expect(baseTitle("Mobile Suit Gundam 0080")).toBe("Mobile Suit Gundam");
    expect(
      titlesMatch(["Mobile Suit Gundam 0080"], ["Mobile Suit Gundam 0080"]),
    ).toBe(true);
  });
});

describe("findAnchors", () => {
  it("finds the episode that aired on the start date, a day either way", () => {
    expect(findAnchors(opm, day("2019-04-09"))).toEqual([
      { season: 2, episode: 1 },
    ]);
  });

  it("falls back to the specials only when no regular episode matches", () => {
    expect(findAnchors(opm, day("2016-03-31"))).toEqual([
      { season: 0, episode: 1 },
    ]);
  });

  it("anchors a premiere that aired several episodes at once on its first", () => {
    const frieren: DatedSeason[] = [
      {
        number: 1,
        episodes: [1, 2, 3, 4].map((number) => ({
          number,
          airDate: day("2023-09-29"),
        })),
      },
    ];

    expect(findAnchors(frieren, day("2023-09-29"))).toEqual([
      { season: 1, episode: 1 },
    ]);
  });

  it("finds nothing for a date TMDB has no episode on", () => {
    expect(findAnchors(opm, day("2017-01-01"))).toEqual([]);
  });
});

describe("mapEpisodes", () => {
  it("walks a cour onto the TMDB season it starts", () => {
    const mapping = mapEpisodes(
      opm,
      { season: 2, episode: 1 },
      [
        { number: 1, airDate: new Date("2019-04-09T15:35:00Z") },
        { number: 2, airDate: null },
      ],
      new Set([1, 2]),
    );

    expect(mapping).toEqual({
      ok: true,
      coords: new Map([
        [1, { season: 2, episode: 1 }],
        [2, { season: 2, episode: 2 }],
      ]),
    });
  });

  it("crosses into the next season on an absolute-numbered show", () => {
    const mapping = mapEpisodes(
      opm,
      { season: 1, episode: 3 },
      [
        { number: 1, airDate: null },
        { number: 2, airDate: null },
      ],
      new Set(),
    );

    expect(mapping.ok && mapping.coords.get(2)).toEqual({
      season: 2,
      episode: 1,
    });
  });

  it("refuses a watched episode past TMDB's listing", () => {
    const mapping = mapEpisodes(
      opm,
      { season: 2, episode: 3 },
      [
        { number: 1, airDate: null },
        { number: 2, airDate: null },
      ],
      new Set([2]),
    );

    expect(mapping.ok).toBe(false);
  });

  it("refuses when both sides date an episode days apart", () => {
    const mapping = mapEpisodes(
      opm,
      { season: 2, episode: 1 },
      [{ number: 2, airDate: day("2019-05-30") }],
      new Set([2]),
    );

    expect(mapping.ok).toBe(false);
  });
});

describe("mergeStatus", () => {
  it("never makes a show done from one cour done", () => {
    expect(mergeStatus("COMPLETED", "PLANNED")).toBe("WATCHING");
    expect(mergeStatus("COMPLETED", "COMPLETED")).toBe("COMPLETED");
    expect(mergeStatus("PLANNED", "WATCHING")).toBe("WATCHING");
  });
});
