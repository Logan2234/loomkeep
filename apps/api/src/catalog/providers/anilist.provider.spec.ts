import { MediaSource, MediaType } from "@loomkeep/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { AnilistProvider } from "./anilist.provider";

const FIXTURES = join(__dirname, "..", "..", "..", "test", "fixtures");

// Real AniList responses captured on 2026-07-02 (Frieren, ID 154587).
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

// Node defines global fetch lazily, which confuses vi.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetch(body: unknown): void {
  global.fetch = vi.fn(() =>
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
    vi.spyOn(Date, "now").mockImplementation(() => (now += 5000));
    const quota = { record: vi.fn() };
    provider = new AnilistProvider(quota as unknown as QuotaTrackerService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
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

  it("resolves a MyAnimeList id through AniList's idMal field", async () => {
    mockFetch({
      data: {
        Media: {
          id: 154587,
          title: { romaji: "Sousou no Frieren", english: "Frieren" },
          seasonYear: 2023,
          coverImage: { large: "https://example.com/frieren.jpg" },
          isAdult: false,
        },
      },
    });

    await expect(provider.getSummaryByMalId("52991")).resolves.toMatchObject({
      source: "ANILIST",
      sourceId: "154587",
      type: MediaType.ANIME,
      title: "Frieren",
    });
    expect(
      JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
      ),
    ).toMatchObject({
      variables: { idMal: 52991 },
    });
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
    // Named after the entry itself: sequels are separate AniList entries.
    expect(season.title).toBe("Frieren: Beyond Journey's End");
    expect(season.episodes).toHaveLength(28);
    // The fixture carries no `duration`, so no per-episode runtime either.
    expect(season.episodes[0]).toEqual({
      number: 1,
      // The "Episode N - " prefix is dropped: the number is shown alongside.
      title: "The Journey's End",
      airDate: null,
      runtimeMin: null,
      overview: null,
      stillUrl: null,
    });
  });

  it("fails fast on a 429 instead of waiting out AniList's minute-long ban", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
          format: "TV",
          episodes: null,
          startDate: { year: 2026, month: 1, day: 5 },
          nextAiringEpisode: { episode: 8 },
          streamingEpisodes: [],
          duration: 24,
        },
      },
    });

    const details = await provider.getDetails("999");

    // 7 aired episodes (next airing is #8), romaji title fallback.
    expect(details.summary.title).toBe("Ongoing Show");
    expect(details.format).toBe("TV");
    expect(details.seasons[0].episodes).toHaveLength(7);
    // AniList only has a per-title duration, copied onto every episode.
    expect(details.seasons[0].episodes.every((e) => e.runtimeMin === 24)).toBe(
      true,
    );
  });

  it("names episodes by the number in their streaming title, not their position", async () => {
    mockFetch({
      data: {
        Media: {
          id: 998,
          title: { romaji: "Reversed Show", english: null },
          description: null,
          coverImage: {},
          bannerImage: null,
          genres: [],
          status: "FINISHED",
          format: "TV",
          episodes: 4,
          startDate: { year: 2026, month: 1, day: 5 },
          nextAiringEpisode: null,
          // Newest first, as AniList often returns them, one with no number.
          streamingEpisodes: [
            { title: "Episode 4 - Reunion" },
            { title: "Episode 3 - Dirty Roads" },
            { title: "Special Preview" },
            { title: "Episode 1 - Light of Science" },
          ],
          duration: 24,
        },
      },
    });

    const details = await provider.getDetails("998");

    expect(details.seasons[0].episodes.map((e) => e.title)).toEqual([
      "Light of Science",
      null,
      "Dirty Roads",
      "Reunion",
    ]);
  });

  it("names no episode when a related anime carries the same streaming episodes", async () => {
    // AniList copies one season's Crunchyroll episodes onto every entry of
    // some franchises (every Dr. STONE season lists New World's).
    const shared = [
      { title: "Episode 2 - SCIENCE JOURNEY", url: "https://cr.example/2" },
      { title: "Episode 1 - RYUSUI VS. SENKU", url: "https://cr.example/1" },
    ];
    mockFetch({
      data: {
        Media: {
          id: 996,
          title: { romaji: "Dr. STONE", english: null },
          description: null,
          coverImage: {},
          bannerImage: null,
          genres: [],
          status: "FINISHED",
          format: "TV",
          episodes: 2,
          startDate: { year: 2019, month: 7, day: 5 },
          nextAiringEpisode: null,
          streamingEpisodes: shared,
          duration: 24,
          relations: {
            edges: [
              {
                node: {
                  id: 995,
                  type: "ANIME",
                  streamingEpisodes: [{ url: "https://cr.example/1" }],
                },
              },
            ],
          },
        },
      },
    });

    const details = await provider.getDetails("996");

    expect(details.seasons[0].episodes.map((e) => e.title)).toEqual([
      null,
      null,
    ]);
  });

  it("shifts a later cour's absolute episode numbers back to 1", async () => {
    mockFetch({
      data: {
        Media: {
          id: 997,
          title: { romaji: "Second Cour", english: null },
          description: null,
          coverImage: {},
          bannerImage: null,
          genres: [],
          status: "FINISHED",
          format: "TV",
          episodes: 2,
          startDate: { year: 2026, month: 4, day: 5 },
          nextAiringEpisode: null,
          streamingEpisodes: [
            { title: "Episode 14 - Second" },
            { title: "Episode 13 - First" },
          ],
          duration: 24,
        },
      },
    });

    const details = await provider.getDetails("997");

    expect(details.seasons[0].episodes.map((e) => e.title)).toEqual([
      "First",
      "Second",
    ]);
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
                  voiceActors: [
                    {
                      id: 112215,
                      name: { full: "Atsumi Tanezaki" },
                      image: { medium: "https://example.com/va.jpg" },
                    },
                  ],
                  node: {
                    name: { full: "Frieren" },
                    image: { medium: "https://example.com/character.jpg" },
                  },
                },
              ],
            },
            relations: {
              edges: [
                {
                  relationType: "SIDE_STORY",
                  node: {
                    id: 999,
                    type: "ANIME",
                    title: { romaji: "Side story", english: null },
                    seasonYear: 2024,
                    coverImage: {},
                    isAdult: false,
                  },
                },
                {
                  relationType: "SEQUEL",
                  node: {
                    id: 998,
                    type: "ANIME",
                    title: { romaji: "Sequel", english: null },
                    seasonYear: 2026,
                    coverImage: {},
                    isAdult: false,
                  },
                },
                {
                  relationType: "ADAPTATION",
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

      const extras = await provider.getExtras(
        "154587",
        MediaType.ANIME,
        undefined,
        "FR",
      );

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
          id: "112215",
          name: "Atsumi Tanezaki",
          role: "Frieren",
          photoUrl: "https://example.com/va.jpg",
          characterPhotoUrl: "https://example.com/character.jpg",
        },
      ]);
      // The manga source is filtered out, and the sequel goes to the saga
      // block: only the side story remains.
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

      const extras = await provider.getExtras(
        "1",
        MediaType.ANIME,
        undefined,
        "FR",
      );

      expect(extras.trailerVideoId).toBeNull();
      expect(extras.cast[0].id).toBeNull();
      expect(extras.cast[0].name).toBe("Unknown");
      expect(extras.cast[0].role).toBeNull();
      expect(extras.cast[0].characterPhotoUrl).toBeNull();
      expect(extras.directors).toEqual([]);
      expect(extras.studios).toEqual([]);
      expect(extras.relations).toEqual([]);
    });
  });

  describe("getSaga", () => {
    const work = (
      id: number,
      year: number | null,
      extra: Record<string, unknown> = {},
    ) => ({
      id,
      type: "ANIME",
      title: { romaji: `Work ${id}`, english: null },
      format: "TV",
      episodes: 12,
      status: year ? "FINISHED" : "NOT_YET_RELEASED",
      startDate: { year, month: 4, day: 1 },
      coverImage: {},
      isAdult: false,
      ...extra,
    });
    const edge = (relationType: string, node: object) => ({
      relationType,
      node,
    });

    function mockFetchSequence(bodies: unknown[]): ReturnType<typeof vi.fn> {
      const fn = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(bodies.shift()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
      global.fetch = fn as unknown as typeof fetch;
      return fn;
    }

    it("walks prequels and sequels out from the viewed work, oldest first, leaving side stories out", async () => {
      // Viewing season 2: season 1 before it, season 3 after, then an
      // announced season 4 and a side story that stays out of the saga.
      const fetchMock = mockFetchSequence([
        {
          data: {
            Page: {
              media: [
                work(2, 2017, {
                  relations: {
                    edges: [
                      edge("PREQUEL", work(1, 2013)),
                      edge("SEQUEL", work(3, 2018)),
                      edge("SIDE_STORY", work(50, 2014)),
                    ],
                  },
                }),
              ],
            },
          },
        },
        {
          data: {
            Page: {
              media: [
                work(1, 2013, {
                  relations: { edges: [edge("SEQUEL", work(2, 2017))] },
                }),
                work(3, 2018, {
                  relations: {
                    edges: [
                      edge("PREQUEL", work(2, 2017)),
                      edge("SEQUEL", work(4, null)),
                    ],
                  },
                }),
              ],
            },
          },
        },
        {
          data: {
            Page: {
              media: [
                work(4, null, {
                  relations: { edges: [edge("PREQUEL", work(3, 2018))] },
                }),
              ],
            },
          },
        },
      ]);

      const saga = await provider.getSaga("2");

      expect(saga?.key).toBe("ANILIST:1");
      expect(saga?.title).toBe("Work 1");
      expect(saga?.members.map((m) => [m.sourceId, m.upcoming])).toEqual([
        ["1", false],
        ["2", false],
        ["3", false],
        ["4", true],
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("finds no saga for a work without prequel or sequel", async () => {
      mockFetchSequence([
        {
          data: {
            Page: {
              media: [
                work(7, 2020, {
                  relations: { edges: [edge("SPIN_OFF", work(8, 2021))] },
                }),
              ],
            },
          },
        },
      ]);

      expect(await provider.getSaga("7")).toBeNull();
    });
  });

  describe("getPerson", () => {
    it("maps an AniList staff member, filtering knownFor to anime-type credits", async () => {
      mockFetch({
        data: {
          Staff: {
            name: { full: "Atsumi Tanezaki" },
            image: { large: "https://example.com/large.jpg" },
            description:
              "**Height:** 157 cm\n\n[Twitter](https://twitter.com/x)",
            dateOfBirth: { year: 1990 },
            dateOfDeath: { year: null },
            homeTown: "Oita, Japan",
            characterMedia: {
              nodes: [
                {
                  id: 154587,
                  type: "ANIME",
                  title: { romaji: "Frieren", english: null },
                  seasonYear: 2023,
                  coverImage: {},
                  isAdult: false,
                },
                {
                  id: 1,
                  type: "MANGA",
                  title: { romaji: "Some manga", english: null },
                  coverImage: {},
                },
              ],
            },
          },
        },
      });

      const person = await provider.getPerson("112215");

      expect(person.name).toBe("Atsumi Tanezaki");
      expect(person.photoUrl).toBe("https://example.com/large.jpg");
      expect(person.subtitle).toBe("1990 · Oita, Japan");
      // Markdown syntax stripped, plain text kept.
      expect(person.description).toBe("Height: 157 cm\n\nTwitter");
      expect(person.knownFor).toHaveLength(1);
      expect(person.knownFor[0].sourceId).toBe("154587");
      expect(person.imdbId).toBeNull();
      expect(person.wikidataId).toBeNull();
      expect(person.homepage).toBeNull();
    });

    it("throws when AniList has no such staff id", async () => {
      mockFetch({ data: { Staff: null } });

      await expect(provider.getPerson("999999")).rejects.toThrow();
    });
  });
});
