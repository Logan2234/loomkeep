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
  let provider: AnilistProvider;

  beforeEach(() => {
    // The provider throttles calls to stay under AniList's 90 req/min cap via
    // Date.now(); advance it well past the threshold on every read so tests
    // don't actually sleep. Fresh provider each time so its throttle state
    // doesn't leak across tests along with the mock.
    let now = 0;
    jest.spyOn(Date, "now").mockImplementation(() => (now += 5000));
    const quota = { record: jest.fn() };
    provider = new AnilistProvider(quota as unknown as QuotaTrackerService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("maps search results, preferring the English title", async () => {
    mockFetch(fixture("anilist-search.json"));

    const results = await provider.search("Frieren");

    expect(results.length).toBeGreaterThan(0);
    const frieren = results.find((r) => r.sourceId === "154587");
    expect(frieren).toMatchObject({
      source: "ANILIST",
      type: MediaType.ANIME,
      title: "Frieren: Beyond Journey's End",
      year: 2023,
    });
    expect(frieren?.posterUrl).toMatch(/^https:\/\//);
  });

  it("maps details: one generated season, episode titles from streaming episodes", async () => {
    mockFetch(fixture("anilist-details.json"));

    const details = await provider.getDetails("154587");

    expect(details.summary.title).toBe("Frieren: Beyond Journey's End");
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

  it("fails fast on a 429 instead of waiting out AniList's minute-long ban", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(provider.search("Frieren")).rejects.toThrow();
    // A single attempt: the 60s Retry-After blows past maxRetryDelayMs, so
    // the call gives up rather than retrying.
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    const details = await provider.getDetails("999");

    // 7 aired episodes (next airing is #8), romaji title fallback.
    expect(details.summary.title).toBe("Ongoing Show");
    expect(details.seasons[0].episodes).toHaveLength(7);
  });

  describe("getExtras", () => {
    it("maps studios, format, season, tags, relations, links and the Japanese voice actor", async () => {
      mockFetch({
        data: {
          Media: {
            averageScore: 91,
            siteUrl: "https://anilist.co/anime/154587",
            format: "TV",
            season: "FALL",
            trailer: { id: "abc123", site: "youtube" },
            studios: {
              edges: [
                { isMain: true, node: { name: "Madhouse" } },
                { isMain: false, node: { name: "Some Other Credit" } },
              ],
            },
            tags: [
              { name: "Iyashikei", isMediaSpoiler: false },
              { name: "A Late-Story Twist", isMediaSpoiler: true },
            ],
            externalLinks: [
              { site: "Crunchyroll", url: "https://crunchyroll.com/frieren" },
            ],
            staff: {
              edges: [
                {
                  role: "Director",
                  node: { name: { full: "Keiichirou Saitou" } },
                },
                {
                  role: "Series Composition",
                  node: { name: { full: "Someone Else" } },
                },
              ],
            },
            characters: {
              edges: [
                {
                  voiceActors: [{ name: { full: "Atsumi Tanezaki" } }],
                  node: { name: { full: "Frieren" }, image: { medium: null } },
                },
              ],
            },
            relations: {
              edges: [
                {
                  node: {
                    id: 999,
                    type: "ANIME",
                    title: { romaji: "Sequel", english: null },
                    seasonYear: 2024,
                    coverImage: {},
                    isAdult: false,
                  },
                },
                {
                  node: {
                    id: 1,
                    type: "MANGA",
                    title: { romaji: "Source manga", english: null },
                    coverImage: {},
                  },
                },
              ],
            },
            recommendations: { nodes: [] },
          },
        },
      });

      const extras = await provider.getExtras("154587");

      expect(extras.ratings).toEqual([
        {
          source: "AniList",
          score: "91%",
          url: "https://anilist.co/anime/154587",
        },
      ]);
      expect(extras.format).toBe("TV");
      expect(extras.season).toBe("FALL");
      expect(extras.trailerVideoId).toBe("abc123");
      expect(extras.studios).toEqual(["Madhouse"]);
      expect(extras.tags).toEqual(["Iyashikei"]);
      expect(extras.externalLinks).toEqual([
        { name: "Crunchyroll", url: "https://crunchyroll.com/frieren" },
      ]);
      expect(extras.directors).toEqual(["Keiichirou Saitou"]);
      expect(extras.cast).toEqual([
        {
          id: null,
          name: "Frieren",
          role: "Atsumi Tanezaki",
          photoUrl: null,
        },
      ]);
      // The manga source is filtered out; only the anime sequel remains.
      expect(extras.relations).toHaveLength(1);
      expect(extras.relations[0].sourceId).toBe("999");
    });

    it("ignores non-YouTube trailers and falls back to the character name when no voice actor is credited", async () => {
      mockFetch({
        data: {
          Media: {
            trailer: { id: "xyz", site: "dailymotion" },
            characters: {
              edges: [{ voiceActors: [], node: { name: { full: "Unknown" } } }],
            },
            recommendations: { nodes: [] },
          },
        },
      });

      const extras = await provider.getExtras("1");

      expect(extras.trailerVideoId).toBeNull();
      expect(extras.cast[0].role).toBeNull();
      expect(extras.directors).toEqual([]);
      expect(extras.studios).toEqual([]);
      expect(extras.relations).toEqual([]);
    });
  });
});
