import { MediaSource, MediaType } from "@loomkeep/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { AnilistProvider } from "./anilist.provider";

const FIXTURES = join(__dirname, "..", "..", "..", "test", "fixtures");

// Real AniList responses captured on 2026-07-02 (Frieren, ID 154587).
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetch(body: unknown): void {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  ) as typeof fetch;
}

describe("AnilistProvider", () => {
  const quota = { record: jest.fn() };
  const provider = new AnilistProvider(quota as unknown as QuotaTrackerService);

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps search results, preferring the English title", async () => {
    mockFetch(fixture("anilist-search.json"));

    const results = await provider.search("Frieren");

    expect(results.length).toBeGreaterThan(0);
    const frieren = results.find((r) => r.sourceId === "154587");
    expect(frieren).toMatchObject({
      source: "ANILIST",
      type: MediaType.ANIME,
      title: "Frieren: Beyond Journey’s End",
      year: 2023,
    });
    expect(frieren?.posterUrl).toMatch(/^https:\/\//);
  });

  it("maps details: one generated season, episode titles from streaming episodes", async () => {
    mockFetch(fixture("anilist-details.json"));

    const details = await provider.getDetails("154587", MediaType.ANIME);

    expect(details.summary.title).toBe("Frieren: Beyond Journey’s End");
    expect(details.genres).toEqual(["Adventure", "Drama", "Fantasy"]);
    expect(details.status).toBe("FINISHED");
    expect(details.releaseDate).toBe("2023-09-29");
    // HTML noise like <br> must be stripped from the synopsis.
    expect(details.overview).not.toMatch(/<[^>]+>/);
    expect(details.externalIds).toEqual([
      { source: MediaSource.ANILIST, externalId: "154587" },
    ]);

    expect(details.seasons).toHaveLength(1);
    const [season] = details.seasons;
    expect(season.number).toBe(1);
    expect(season.episodes).toHaveLength(28);
    expect(season.episodes[0]).toEqual({
      number: 1,
      title: "Episode 1 - The Journey's End",
      airDate: null,
    });
  });

  it("falls back to aired count for ongoing shows without a total episode count", async () => {
    mockFetch({
      data: {
        Media: {
          id: 999,
          title: { romaji: "Ongoing Show", english: null },
          description: null,
          coverImage: {},
          bannerImage: null,
          genres: [],
          status: "RELEASING",
          episodes: null,
          startDate: { year: 2026, month: 1, day: 5 },
          nextAiringEpisode: { episode: 8 },
          streamingEpisodes: [],
        },
      },
    });

    const details = await provider.getDetails("999", MediaType.ANIME);

    // 7 aired episodes (next airing is #8), romaji title fallback.
    expect(details.summary.title).toBe("Ongoing Show");
    expect(details.seasons[0].episodes).toHaveLength(7);
  });
});
