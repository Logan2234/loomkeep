import type { MediaSummaryDto } from "@loomkeep/shared";
import { rankBySearchRelevance, relevanceScore } from "./search-ranking";

const media = (
  title: string,
  extra: Partial<MediaSummaryDto> = {},
): MediaSummaryDto => ({
  source: "TMDB",
  sourceId: title,
  type: "SERIES",
  title,
  year: null,
  posterUrl: null,
  ...extra,
});

describe("relevanceScore", () => {
  it("ranks exact > starts-with > whole-word > substring > none", () => {
    expect(relevanceScore(media("Breaking Bad"), "breaking bad")).toBe(4);
    expect(relevanceScore(media("Breaking Bad Wolf"), "breaking bad")).toBe(3);
    expect(
      relevanceScore(media("El Camino: A Breaking Bad Movie"), "breaking bad"),
    ).toBe(2);
    expect(relevanceScore(media("Unbreaking"), "breaking")).toBe(1);
    expect(relevanceScore(media("Better Call Saul"), "breaking bad")).toBe(0);
  });

  it("is diacritics- and case-insensitive", () => {
    expect(relevanceScore(media("Pokémon"), "pokemon")).toBe(4);
  });

  it("also matches the original title", () => {
    expect(
      relevanceScore(
        media("Frieren: Beyond Journey's End", {
          originalTitle: "Sousou no Frieren",
        }),
        "sousou no frieren",
      ),
    ).toBe(4);
  });
});

describe("rankBySearchRelevance", () => {
  it("floats the best title match to the top, keeping input order on ties", () => {
    const results = [
      media("El Camino: A Breaking Bad Movie", { type: "MOVIE" }),
      media("Breaking Bad Wolf", { type: "MOVIE" }),
      media("Breaking Bad"), // the actual series, last in input
    ];
    const ranked = rankBySearchRelevance(results, "breaking bad");
    expect(ranked.map((m) => m.title)).toEqual([
      "Breaking Bad",
      "Breaking Bad Wolf",
      "El Camino: A Breaking Bad Movie",
    ]);
  });

  it("preserves input order among equally-relevant results", () => {
    const results = [media("A Breaking Story"), media("The Breaking Point")];
    const ranked = rankBySearchRelevance(results, "breaking");
    expect(ranked.map((m) => m.title)).toEqual([
      "A Breaking Story",
      "The Breaking Point",
    ]);
  });
});
