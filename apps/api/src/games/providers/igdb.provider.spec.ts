import { ConfigService } from "@nestjs/config";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { IgdbProvider } from "./igdb.provider";

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
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
    jest.spyOn(Date, "now").mockImplementation(() => (now += 5000));

    const config = { getOrThrow: jest.fn().mockReturnValue("test-credential") };
    const quota = { record: jest.fn() };
    provider = new IgdbProvider(
      config as unknown as ConfigService,
      quota as unknown as QuotaTrackerService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
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
      ratings: [],
      externalIds: [{ source: "IGDB", externalId: "1020" }],
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
