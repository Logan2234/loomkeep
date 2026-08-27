import { MediaSource, MediaType } from "@loomkeep/shared";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { QuotaTrackerService } from "../../common/quota-tracker.service";
import { OmdbService } from "../omdb.service";
import { TmdbProvider } from "./tmdb.provider";

const FIXTURES = join(__dirname, "..", "..", "..", "test", "fixtures");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

// Node defines global fetch lazily, which confuses jest.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): void {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
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
  }) as typeof fetch;
}

describe("TmdbProvider", () => {
  let provider: TmdbProvider;

  beforeEach(() => {
    const config = { getOrThrow: jest.fn().mockReturnValue("test-token") };
    const omdb = { getRatings: jest.fn().mockResolvedValue([]) };
    const quota = { record: jest.fn() };
    provider = new TmdbProvider(
      config as unknown as ConfigService,
      omdb as unknown as OmdbService,
      quota as unknown as QuotaTrackerService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps movie search results to canonical summaries", async () => {
    mockFetchByUrl({
      "/search/movie": fixture("tmdb-search-movie.json"),
      "/search/tv": { results: [] },
    });

    const results = await provider.search("Inception", MediaType.MOVIE);

    expect(results).toEqual([
      {
        source: "TMDB",
        sourceId: "27205",
        type: MediaType.MOVIE,
        title: "Inception",
        originalTitle: "Inception",
        year: 2010,
        posterUrl:
          "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        isAdult: false,
      },
    ]);
  });

  it("searches both movies and series when no type is given", async () => {
    mockFetchByUrl({
      "/search/movie": fixture("tmdb-search-movie.json"),
      "/search/tv": fixture("tmdb-search-tv.json"),
    });

    const results = await provider.search("anything");

    expect(results.map((r) => r.type)).toEqual([
      MediaType.MOVIE,
      MediaType.SERIES,
    ]);
    expect(results[1].title).toBe("Breaking Bad");
  });

  it("maps movie details with external IDs and no seasons", async () => {
    mockFetchByUrl({ "/movie/27205": fixture("tmdb-movie-details.json") });

    const details = await provider.getDetails("27205", MediaType.MOVIE);

    expect(details.summary.title).toBe("Inception");
    expect(details.genres).toEqual(["Action", "Science Fiction", "Adventure"]);
    expect(details.releaseDate).toBe("2010-07-15");
    expect(details.seasons).toEqual([]);
    expect(details.externalIds).toContainEqual({
      source: MediaSource.TMDB,
      externalId: "27205",
    });
    expect(details.externalIds).toContainEqual({
      source: MediaSource.IMDB,
      externalId: "tt1375666",
    });
  });

  it("resolves a TVDB series id to a TMDB summary via /find", async () => {
    mockFetchByUrl({
      "/find/81189": {
        tv_results: [
          {
            id: 1396,
            name: "Breaking Bad",
            first_air_date: "2008-01-20",
            poster_path: "/bb.jpg",
          },
        ],
        movie_results: [],
      },
    });

    const summary = await provider.findSeriesSummaryByTvdbId("81189");
    expect(summary).toMatchObject({
      source: "TMDB",
      sourceId: "1396",
      type: MediaType.SERIES,
      title: "Breaking Bad",
      year: 2008,
    });
  });

  it("returns null when /find has no TV result for the TVDB id", async () => {
    mockFetchByUrl({ "/find/999999": { tv_results: [], movie_results: [] } });

    await expect(
      provider.findSeriesSummaryByTvdbId("999999"),
    ).resolves.toBeNull();
  });

  it("maps series details with TVDB ID and per-season episodes (specials included)", async () => {
    mockFetchByUrl({
      "/tv/1396/season/0": fixture("tmdb-season-0.json"),
      "/tv/1396/season/1": fixture("tmdb-season-1.json"),
      "/tv/1396": fixture("tmdb-tv-details.json"),
    });

    const details = await provider.getDetails("1396", MediaType.SERIES);

    expect(details.summary).toMatchObject({
      type: MediaType.SERIES,
      title: "Breaking Bad",
    });
    // The TVDB ID is what makes a future TV Time import reconcilable.
    expect(details.externalIds).toContainEqual({
      source: MediaSource.TVDB,
      externalId: "81189",
    });
    expect(details.externalIds).toContainEqual({
      source: MediaSource.IMDB,
      externalId: "tt0903747",
    });

    expect(details.seasons.map((s) => s.number)).toEqual([0, 1]);
    const seasonOne = details.seasons.find((s) => s.number === 1);
    expect(seasonOne?.episodes).toEqual([
      { number: 1, title: "Pilot", airDate: "2008-01-20" },
      { number: 2, title: "Cat's in the Bag...", airDate: "2008-01-27" },
    ]);
  });

  it("maps a person with a most-popular, deduped, poster-only knownFor list", async () => {
    mockFetchByUrl({
      "/person/62": {
        name: "Bryan Cranston",
        biography: "  An American actor.  ",
        birthday: "1956-03-07",
        deathday: null,
        place_of_birth: "Hollywood, California, USA",
        profile_path: "/bc.jpg",
        homepage: "https://bryancranston.com",
        external_ids: { imdb_id: "nm0186505", wikidata_id: "Q193815" },
        combined_credits: {
          cast: [
            // No poster → filtered out.
            { id: 1, media_type: "movie", title: "No Poster", popularity: 99 },
            {
              id: 1396,
              media_type: "tv",
              name: "Breaking Bad",
              first_air_date: "2008-01-20",
              poster_path: "/bb.jpg",
              popularity: 50,
            },
            {
              id: 27205,
              media_type: "movie",
              title: "Inception",
              release_date: "2010-07-15",
              poster_path: "/in.jpg",
              popularity: 80,
            },
            // Duplicate id → collapsed.
            {
              id: 1396,
              media_type: "tv",
              name: "Breaking Bad",
              poster_path: "/bb.jpg",
              popularity: 40,
            },
          ],
        },
      },
    });

    const person = await provider.getPerson("62");

    expect(person.name).toBe("Bryan Cranston");
    expect(person.description).toBe("An American actor."); // trimmed
    expect(person.subtitle).toBe("1956 · Hollywood, California, USA");
    expect(person.photoUrl).toBe("https://image.tmdb.org/t/p/w185/bc.jpg");
    expect(person.imdbId).toBe("nm0186505");
    expect(person.wikidataId).toBe("Q193815");
    expect(person.homepage).toBe("https://bryancranston.com");
    // Sorted by popularity desc (Inception 80 > Breaking Bad 50), deduped,
    // the poster-less credit dropped, types mapped from media_type.
    expect(
      person.knownFor.map((k) => ({ id: k.sourceId, type: k.type })),
    ).toEqual([
      { id: "27205", type: MediaType.MOVIE },
      { id: "1396", type: MediaType.SERIES },
    ]);
  });

  describe("getExtras", () => {
    it("sends the requested language, defaulting to English", async () => {
      let requestedUrl = "";
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        requestedUrl = String(input);
        return Promise.resolve(
          new Response(JSON.stringify({ id: 27205 }), { status: 200 }),
        );
      }) as typeof fetch;

      await provider.getExtras("27205", MediaType.MOVIE);
      expect(decodeURIComponent(requestedUrl)).toContain("language=en-US");

      await provider.getExtras("27205", MediaType.MOVIE, "fr");
      expect(decodeURIComponent(requestedUrl)).toContain("language=fr-FR");
    });

    it("maps tagline and TMDB's own vote rating, linked to the TMDB page", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          tagline: "Your mind is the scene of the crime.",
          vote_average: 8.369,
          vote_count: 35000,
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.tagline).toBe("Your mind is the scene of the crime.");
      expect(extras.ratings).toEqual([
        {
          source: "TMDB",
          score: "8.4/10 (35000)",
          url: "https://www.themoviedb.org/movie/27205",
        },
      ]);
    });

    it("omits the TMDB rating when the vote count is missing", async () => {
      mockFetchByUrl({
        "/movie/27205": { id: 27205, vote_average: 8.4 },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.ratings).toEqual([]);
    });

    it("maps a movie's director from credits.crew, deduped", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          credits: {
            crew: [
              { id: 1, name: "Christopher Nolan", job: "Director" },
              { id: 1, name: "Christopher Nolan", job: "Director" },
              { id: 2, name: "Someone Else", job: "Producer" },
            ],
          },
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.directors).toEqual(["Christopher Nolan"]);
    });

    it("maps a series' creators from created_by, not credits.crew", async () => {
      mockFetchByUrl({
        "/tv/1396": {
          id: 1396,
          created_by: [{ id: 1, name: "Vince Gilligan" }],
          credits: {
            crew: [{ id: 2, name: "Someone Else", job: "Director" }],
          },
        },
      });

      const extras = await provider.getExtras("1396", MediaType.SERIES);

      expect(extras.directors).toEqual(["Vince Gilligan"]);
    });

    it("picks the official trailer over other YouTube videos", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          videos: {
            results: [
              { site: "YouTube", type: "Teaser", key: "teaser1" },
              {
                site: "YouTube",
                type: "Trailer",
                key: "trailer1",
                official: false,
              },
              {
                site: "YouTube",
                type: "Trailer",
                key: "trailer2",
                official: true,
              },
              { site: "Vimeo", type: "Trailer", key: "vimeo1" },
            ],
          },
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.trailerVideoId).toBe("trailer2");
    });

    it("falls back to the first YouTube trailer when none is official", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          videos: {
            results: [{ site: "YouTube", type: "Trailer", key: "trailer1" }],
          },
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.trailerVideoId).toBe("trailer1");
    });

    it("returns no trailer when TMDB lists none", async () => {
      mockFetchByUrl({ "/movie/27205": { id: 27205 } });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.trailerVideoId).toBeNull();
    });

    it("maps a movie's certification, preferring FR over US", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          release_dates: {
            results: [
              {
                iso_3166_1: "US",
                release_dates: [{ certification: "PG-13" }],
              },
              { iso_3166_1: "FR", release_dates: [{ certification: "12" }] },
            ],
          },
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.contentRating).toBe("12");
    });

    it("falls back to the US certification when there is no FR one", async () => {
      mockFetchByUrl({
        "/movie/27205": {
          id: 27205,
          release_dates: {
            results: [
              {
                iso_3166_1: "US",
                release_dates: [{ certification: "PG-13" }],
              },
            ],
          },
        },
      });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.contentRating).toBe("PG-13");
    });

    it("maps a series' certification from content_ratings", async () => {
      mockFetchByUrl({
        "/tv/1396": {
          id: 1396,
          content_ratings: {
            results: [
              { iso_3166_1: "US", rating: "TV-MA" },
              { iso_3166_1: "FR", rating: "16" },
            ],
          },
        },
      });

      const extras = await provider.getExtras("1396", MediaType.SERIES);

      expect(extras.contentRating).toBe("16");
    });

    it("returns no certification when TMDB reports none", async () => {
      mockFetchByUrl({ "/movie/27205": { id: 27205 } });

      const extras = await provider.getExtras("27205", MediaType.MOVIE);

      expect(extras.contentRating).toBeNull();
    });
  });
});
