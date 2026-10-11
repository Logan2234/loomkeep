import type { WorkSearchHitDto } from "@loomkeep/shared";
import {
  FOLD_FROM,
  FOLD_TO,
  foldForSearch,
  parseWorkQuery,
  rankWorks,
  type SearchDomain,
  type WorkCandidate,
} from "./work-search-ranking";

function candidate(
  title: string,
  overrides: Partial<WorkSearchHitDto> & {
    domain?: SearchDomain;
    index?: number;
    trackers?: number;
  } = {},
): WorkCandidate {
  const { domain = "MEDIA", index = 0, trackers = 0, ...hit } = overrides;
  return {
    domain,
    source: "TMDB",
    sourceId: title,
    index,
    trackers,
    hit: {
      kind: "MOVIE",
      title,
      imageUrl: null,
      href: `/app/media/movie/${title}`,
      year: null,
      isAdult: false,
      status: null,
      ...hit,
    },
  };
}

const titles = (ranked: WorkCandidate[]) => ranked.map((c) => c.hit.title);

describe("foldForSearch", () => {
  it("folds accents and case the way the SQL translate() does", () => {
    expect(foldForSearch("Amélie Poulain")).toBe("amelie poulain");
    expect(foldForSearch("ÉVANGÉLION")).toBe("evangelion");
    expect(foldForSearch("Pokémon Ōkami Łódź")).toBe("pokemon okami lodz");
  });

  it("maps each character to one, as translate() needs", () => {
    expect([...FOLD_FROM]).toHaveLength([...FOLD_TO].length);
  });
});

describe("parseWorkQuery", () => {
  it("reads an ISBN, hyphens and all", () => {
    expect(parseWorkQuery("978-2-07-036024-5")).toEqual({
      text: "978-2-07-036024-5",
      year: null,
      isbn: "9782070360245",
    });
  });

  it("splits a year typed after the title", () => {
    expect(parseWorkQuery("dune 2021")).toEqual({
      text: "dune",
      year: 2021,
      isbn: null,
    });
  });

  it("leaves a title that is only a year alone", () => {
    expect(parseWorkQuery("1917")).toEqual({
      text: "1917",
      year: null,
      isbn: null,
    });
  });
});

describe("rankWorks", () => {
  it("puts the better title match first, tracked or not", () => {
    const ranked = rankWorks(
      [
        candidate("Dune", { status: "COMPLETED" }),
        candidate("Dune : Deuxième partie"),
      ],
      "deuxieme partie",
      parseWorkQuery("deuxieme partie"),
    );

    expect(titles(ranked)).toEqual(["Dune : Deuxième partie", "Dune"]);
  });

  it("prefers the year typed after the title", () => {
    const query = parseWorkQuery("dune 2021");
    const ranked = rankWorks(
      [candidate("Dune", { year: 1984 }), candidate("Dune", { year: 2021 })],
      "dune 2021",
      query,
    );

    expect(ranked.map((c) => c.hit.year)).toEqual([2021, 1984]);
  });

  it("keeps a year that is part of the title", () => {
    const query = parseWorkQuery("blade runner 2049");
    const ranked = rankWorks(
      [candidate("Blade Runner"), candidate("Blade Runner 2049", { index: 1 })],
      "blade runner 2049",
      query,
    );

    expect(titles(ranked)[0]).toBe("Blade Runner 2049");
  });

  it("lifts what the viewer tracks, then what the instance tracks", () => {
    const ranked = rankWorks(
      [
        candidate("Dune Prophecy", { index: 0 }),
        candidate("Dune Awakening", { domain: "GAMES", index: 1, trackers: 3 }),
        candidate("Dune Messiah", {
          domain: "BOOKS",
          index: 2,
          status: "READ",
        }),
      ],
      "dune",
      parseWorkQuery("dune"),
    );

    expect(titles(ranked)).toEqual([
      "Dune Messiah",
      "Dune Awakening",
      "Dune Prophecy",
    ]);
  });

  it("interleaves the domains on a tie, each in its source's order", () => {
    const ranked = rankWorks(
      [
        candidate("Dune A", { index: 0 }),
        candidate("Dune B", { index: 1 }),
        candidate("Dune C", { domain: "GAMES", index: 0 }),
        candidate("Dune D", { domain: "GAMES", index: 1 }),
      ],
      "dune",
      parseWorkQuery("dune"),
    );

    expect(titles(ranked)).toEqual(["Dune A", "Dune C", "Dune B", "Dune D"]);
  });
});
