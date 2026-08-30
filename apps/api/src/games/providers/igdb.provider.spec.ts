import { ConfigService } from "@nestjs/config";
import { vi, type Mock } from "vitest";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { IgdbProvider } from "./igdb.provider";

// Node defines global fetch lazily, which confuses vi.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): Mock {
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([pathPart]) =>
      url.includes(pathPart),
    );

    if (!match) {
      throw new Error(`Unexpected fetch call in test: ${url}`);
    }

    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const TOKEN_RESPONSE = { access_token: "app-token", expires_in: 3600 };

describe("IgdbProvider", () => {
  let provider: IgdbProvider;

  beforeEach(() => {
    // The provider throttles calls to stay under IGDB's 4 req/s cap via
    // Date.now(); advance it well past the threshold on every read so tests
    // don't actually sleep.
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 5000));

    const config = { getOrThrow: vi.fn().mockReturnValue("test-credential") };
    const quota = { record: vi.fn() };
    provider = new IgdbProvider(
      config as unknown as ConfigService,
      quota as unknown as QuotaTrackerService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("maps search results to canonical summaries", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          // 2013-09-17 UTC.
          first_release_date: 1379376000,
          cover: { image_id: "co1r7f" },
        },
        // No cover / no date → nulls. Theme 42 (Erotic) → isAdult.
        { id: 7331, name: "Untitled", themes: [1, 42] },
      ],
    });

    const results = await provider.search("gta");

    expect(results).toEqual([
      {
        source: "IGDB",
        sourceId: "1020",
        title: "Grand Theft Auto V",
        year: 2013,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
        isAdult: false,
      },
      {
        source: "IGDB",
        sourceId: "7331",
        title: "Untitled",
        year: null,
        coverUrl: null,
        isAdult: true,
      },
    ]);
  });

  it('resolves a studio:"…" query to games by that company', async () => {
    const fetchMock = mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/companies": [{ id: 70 }, { id: 71 }],
      "/games": [{ id: 900, name: "Horizon Zero Dawn" }],
    });

    const results = await provider.search('studio:"Guerrilla"');

    expect(results).toEqual([
      {
        source: "IGDB",
        sourceId: "900",
        title: "Horizon Zero Dawn",
        year: null,
        coverUrl: null,
        isAdult: false,
      },
    ]);
    const gamesCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/games"),
    );
    expect(gamesCall?.[1]?.body).toContain(
      "involved_companies.company = (70,71)",
    );
    // /companies doesn't support IGDB's `search` keyword (confirmed against
    // the live API — it silently returns [] rather than erroring); the name
    // must be resolved via a `where … ~ *"…"*` fuzzy-contains filter.
    const companiesCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/companies"),
    );
    expect(companiesCall?.[1]?.body).toContain('where name ~ *"Guerrilla"*');
  });

  it("returns no results when the studio name matches nothing", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/companies": [],
    });

    const results = await provider.search('studio:"Nonexistent Studio Inc"');

    expect(results).toEqual([]);
  });

  it("maps details, deriving artwork url, genres and platforms", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          summary: "An open-world crime epic.",
          first_release_date: 1379376000,
          cover: { image_id: "co1r7f" },
          artworks: [{ image_id: "ar1" }],
          genres: [{ name: "Shooter" }, { name: "Adventure" }],
          platforms: [{ name: "PC (Microsoft Windows)" }, { name: "PS4" }],
          websites: [
            { url: "https://twitter.com/rockstargames", category: 5 },
            { url: "https://www.rockstargames.com/V/", category: 1 },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details).toEqual({
      summary: {
        source: "IGDB",
        sourceId: "1020",
        title: "Grand Theft Auto V",
        year: 2013,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
        isAdult: false,
      },
      overview: "An open-world crime epic.",
      backdropUrl: "https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg",
      screenshots: [],
      genres: ["Shooter", "Adventure"],
      platforms: ["PC (Microsoft Windows)", "PS4"],
      releaseDate: "2013-09-17T00:00:00.000Z",
      website: "https://www.rockstargames.com/V/",
      similarGames: [],
      developers: [],
      publishers: [],
      gameModes: [],
      playerPerspectives: [],
      franchiseGames: [],
      franchiseName: null,
      ratings: [],
      externalIds: [{ source: "IGDB", externalId: "1020" }],
      storyline: null,
      trailerVideoId: null,
      ageRatingImageUrls: [],
      multiplayerModes: [],
    });
  });

  it("maps rating and aggregated_rating to IGDB/Critiques percentages", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          rating: 87.3,
          aggregated_rating: 96.7,
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.ratings).toEqual([
      { source: "IGDB", score: "87%" },
      { source: "Critiques", score: "97%" },
    ]);
  });

  it("omits ratings IGDB doesn't report", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [{ id: 1020, name: "Grand Theft Auto V", rating: 80 }],
    });

    const details = await provider.getDetails("1020");

    expect(details.ratings).toEqual([{ source: "IGDB", score: "80%" }]);
  });

  it("appends vote counts to ratings when IGDB reports them", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          rating: 87.3,
          rating_count: 1284,
          aggregated_rating: 96.7,
          aggregated_rating_count: 12,
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.ratings).toEqual([
      { source: "IGDB", score: "87% (1284)", url: undefined },
      { source: "Critiques", score: "97% (12)", url: undefined },
    ]);
  });

  it("links ratings to the IGDB game page when a slug is known", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          slug: "grand-theft-auto-v",
          rating: 87.3,
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.ratings).toEqual([
      {
        source: "IGDB",
        score: "87%",
        url: "https://www.igdb.com/games/grand-theft-auto-v",
      },
    ]);
  });

  it("picks the video whose name mentions trailer, else the first video", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          videos: [
            { video_id: "teaser1", name: "Teaser" },
            { video_id: "trailer1", name: "Official Trailer" },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.trailerVideoId).toBe("trailer1");
  });

  it("falls back to the first video when none is named trailer", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          videos: [{ video_id: "teaser1", name: "Teaser" }],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.trailerVideoId).toBe("teaser1");
  });

  it("normalises age rating badge urls and dedupes them", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          age_ratings: [
            { rating_cover_url: "//images.igdb.com/esrb.png" },
            { rating_cover_url: "//images.igdb.com/esrb.png" },
            { rating_cover_url: "//images.igdb.com/pegi.png" },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.ageRatingImageUrls).toEqual([
      "https://images.igdb.com/esrb.png",
      "https://images.igdb.com/pegi.png",
    ]);
  });

  it("derives multiplayer mode labels, OR-combined across platform entries", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          multiplayer_modes: [
            { onlinecoop: true, splitscreen: false },
            { splitscreen: true },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.multiplayerModes).toEqual(["Online co-op", "Split screen"]);
  });

  it("maps storyline and the first franchise's name", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          storyline: "Three criminals plan the ultimate heist.",
          franchises: [{ name: "GTA", games: [] }],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.storyline).toBe("Three criminals plan the ultimate heist.");
    expect(details.franchiseName).toBe("GTA");
  });

  it("maps screenshots to urls, capped at 12", async () => {
    const screenshots = Array.from({ length: 14 }, (_, i) => ({
      image_id: `sc${i}`,
    }));
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [{ id: 1020, name: "Grand Theft Auto V", screenshots }],
    });

    const details = await provider.getDetails("1020");

    expect(details.screenshots).toHaveLength(12);
    expect(details.screenshots[0]).toBe(
      "https://images.igdb.com/igdb/image/upload/t_1080p/sc0.jpg",
    );
  });

  it("maps similar games to summaries, capped at 10", async () => {
    const similar = Array.from({ length: 12 }, (_, i) => ({
      id: 2000 + i,
      name: `Similar ${i}`,
    }));
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        { id: 1020, name: "Grand Theft Auto V", similar_games: similar },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.similarGames).toHaveLength(10);
    expect(details.similarGames[0]).toEqual({
      source: "IGDB",
      sourceId: "2000",
      title: "Similar 0",
      year: null,
      coverUrl: null,
      isAdult: false,
    });
  });

  it("maps involved companies to developers/publishers, deduped", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          involved_companies: [
            { company: { name: "Rockstar North" }, developer: true },
            { company: { name: "Rockstar Games" }, publisher: true },
            // Same publisher listed twice (e.g. two regional editions) → deduped.
            { company: { name: "Rockstar Games" }, publisher: true },
            // Neither role set → excluded from both lists.
            { company: { name: "Some Middleware Vendor" } },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.developers).toEqual(["Rockstar North"]);
    expect(details.publishers).toEqual(["Rockstar Games"]);
  });

  it("maps game modes and player perspectives", async () => {
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          game_modes: [{ name: "Single player" }, { name: "Multiplayer" }],
          player_perspectives: [{ name: "Third person" }],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    expect(details.gameModes).toEqual(["Single player", "Multiplayer"]);
    expect(details.playerPerspectives).toEqual(["Third person"]);
  });

  it("maps franchise games, excluding itself and deduping across franchises, uncapped", async () => {
    const gtaGames = Array.from({ length: 14 }, (_, i) => ({
      id: 3000 + i,
      name: `GTA ${i}`,
    }));
    mockFetchByUrl({
      "id.twitch.tv": TOKEN_RESPONSE,
      "/games": [
        {
          id: 1020,
          name: "Grand Theft Auto V",
          franchises: [
            // Includes the game itself (1020) and one overlap with the 2nd
            // franchise (3000) — both must be excluded/deduped.
            {
              name: "GTA",
              games: [{ id: 1020, name: "Grand Theft Auto V" }, ...gtaGames],
            },
            {
              name: "Rockstar Universe",
              games: [
                { id: 3000, name: "GTA 0" },
                { id: 9999, name: "Red Dead Redemption" },
              ],
            },
          ],
        },
      ],
    });

    const details = await provider.getDetails("1020");

    // 14 unique GTA entries + Red Dead Redemption; the self-reference and the
    // GTA 0 / id 3000 overlap between franchises are both excluded once.
    expect(details.franchiseGames).toHaveLength(15);
    expect(details.franchiseGames.map((g) => g.sourceId)).not.toContain("1020");
    expect(details.franchiseGames.map((g) => g.sourceId)).toContain("9999");
  });

  it("throws when IGDB returns no game for an id", async () => {
    mockFetchByUrl({ "id.twitch.tv": TOKEN_RESPONSE, "/games": [] });
    await expect(provider.getDetails("404")).rejects.toThrow(
      "Game not found on IGDB",
    );
  });

  it("reuses the cached access token across calls", async () => {
    const fn = mockFetchByUrl({ "id.twitch.tv": TOKEN_RESPONSE, "/games": [] });

    await provider.search("a");
    await provider.search("b");

    const tokenCalls = fn.mock.calls.filter(([url]) =>
      String(url).includes("id.twitch.tv"),
    );
    expect(tokenCalls).toHaveLength(1);
  });
});
