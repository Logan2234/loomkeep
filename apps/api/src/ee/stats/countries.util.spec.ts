import { computeCountries } from "./countries.util";

const watch = (
  mediaItemId: string,
  originCountries: string[],
  minutes = 45,
) => ({
  watchedAt: null,
  genres: [],
  mediaItemId,
  originCountries,
  minutes,
});

const movie = (
  mediaItemId: string,
  originCountries: string[],
  runtimeMin: number,
  viewings = 1,
) => ({
  mediaItemId,
  originCountries,
  title: mediaItemId,
  runtimeMin,
  genres: [],
  href: `/app/media/${mediaItemId}`,
  viewings,
});

describe("computeCountries", () => {
  it("counts a series once however many episodes were watched", () => {
    const result = computeCountries(
      [watch("dark", ["DE"]), watch("dark", ["DE"]), watch("dark", ["DE"])],
      [],
    );

    expect(result).toEqual([{ country: "DE", titles: 1, minutes: 135 }]);
  });

  it("counts a co-production for each of its countries", () => {
    const result = computeCountries([], [movie("amelie", ["FR", "DE"], 122)]);

    expect(result).toEqual([
      { country: "FR", titles: 1, minutes: 122 },
      { country: "DE", titles: 1, minutes: 122 },
    ]);
  });

  it("adds a film's rewatches to its watch time, not to its titles", () => {
    const result = computeCountries([], [movie("parasite", ["KR"], 132, 3)]);

    expect(result).toEqual([{ country: "KR", titles: 1, minutes: 396 }]);
  });

  it("ranks by titles, then by watch time, and leaves out titles with no country", () => {
    const result = computeCountries(
      [watch("severance", ["US"], 50), watch("mystery", [])],
      [
        movie("heat", ["US"], 170),
        movie("spirited-away", ["JP"], 125),
        movie("tampopo", ["JP"], 114),
        movie("paddington", ["GB"], 95),
      ],
    );

    // US and JP have two titles each; JP has more watch time.
    expect(result.map((r) => r.country)).toEqual(["JP", "US", "GB"]);
  });
});
