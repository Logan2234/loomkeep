import { buildImportMovies, buildImportShows } from "./parse-trakt";
import type {
  TraktWatchedMovie,
  TraktWatchedShow,
  TraktWatchlistMovieItem,
  TraktWatchlistShowItem,
} from "./trakt-api.types";

describe("buildImportShows", () => {
  it("flattens watched seasons/episodes and carries every external id", () => {
    const watched: TraktWatchedShow[] = [
      {
        show: {
          title: "Breaking Bad",
          year: 2008,
          ids: { trakt: 1, tvdb: 81189, imdb: "tt0903747", tmdb: 1396 },
        },
        seasons: [
          {
            number: 1,
            episodes: [
              {
                number: 1,
                plays: 1,
                last_watched_at: "2014-10-15T22:24:29.000Z",
              },
              {
                number: 2,
                plays: 2,
                last_watched_at: "2014-10-16T22:24:29.000Z",
              },
            ],
          },
        ],
      },
    ];

    const shows = buildImportShows(watched, []);

    expect(shows).toEqual([
      {
        title: "Breaking Bad",
        externalIds: { tmdb: "1396", tvdb: "81189", imdb: "tt0903747" },
        episodes: [
          {
            season: 1,
            episode: 1,
            sourceEpisodeId: "1x1",
            watchedAt: new Date("2014-10-15T22:24:29.000Z"),
            totalWatches: 1,
          },
          {
            season: 1,
            episode: 2,
            sourceEpisodeId: "1x2",
            watchedAt: new Date("2014-10-16T22:24:29.000Z"),
            totalWatches: 2,
          },
        ],
      },
    ]);
  });

  it("adds watchlist-only shows with no episodes, deduped against watched", () => {
    const watched: TraktWatchedShow[] = [
      {
        show: { title: "Watched Show", year: 2020, ids: { trakt: 1 } },
        seasons: [],
      },
    ];
    const watchlist: TraktWatchlistShowItem[] = [
      { show: { title: "Watched Show", year: 2020, ids: { trakt: 1 } } },
      { show: { title: "Planned Show", year: 2021, ids: { trakt: 2 } } },
    ];

    const shows = buildImportShows(watched, watchlist);

    expect(shows).toHaveLength(2);
    expect(shows.find((s) => s.title === "Watched Show")?.episodes).toEqual([]);
    expect(shows.find((s) => s.title === "Planned Show")).toMatchObject({
      episodes: [],
      externalIds: { tmdb: undefined, tvdb: undefined, imdb: undefined },
    });
  });
});

describe("buildImportMovies", () => {
  it("marks watched movies as watched and watchlist-only ones as not", () => {
    const watched: TraktWatchedMovie[] = [
      {
        movie: {
          title: "Guardians of the Galaxy",
          year: 2014,
          ids: { trakt: 28, imdb: "tt2015381", tmdb: 118340 },
        },
      },
    ];
    const watchlist: TraktWatchlistMovieItem[] = [
      {
        movie: { title: "Dune", year: 2021, ids: { trakt: 99, tmdb: 438631 } },
      },
    ];

    const movies = buildImportMovies(watched, watchlist);

    expect(movies).toEqual([
      {
        title: "Guardians of the Galaxy",
        year: 2014,
        watched: true,
        externalIds: { tmdb: "118340", tvdb: undefined, imdb: "tt2015381" },
      },
      {
        title: "Dune",
        year: 2021,
        watched: false,
        externalIds: { tmdb: "438631", tvdb: undefined, imdb: undefined },
      },
    ]);
  });

  it("does not duplicate a movie that is both watched and on the watchlist", () => {
    const watched: TraktWatchedMovie[] = [
      { movie: { title: "Dune", year: 2021, ids: { trakt: 99 } } },
    ];
    const watchlist: TraktWatchlistMovieItem[] = [
      { movie: { title: "Dune", year: 2021, ids: { trakt: 99 } } },
    ];

    const movies = buildImportMovies(watched, watchlist);

    expect(movies).toHaveLength(1);
    expect(movies[0].watched).toBe(true);
  });
});
