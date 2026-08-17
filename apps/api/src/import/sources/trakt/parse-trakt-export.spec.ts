import { buildImportMovies, buildImportShows } from "./parse-trakt-export";
import type {
  TraktHistoryEntry,
  TraktWatchlistEntry,
} from "./trakt-export.types";

describe("buildImportShows", () => {
  it("groups episode watch events by show, folding rewatches into a count", () => {
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-07-01T20:49:00.000Z",
        type: "episode",
        episode: { title: "Good vs. Evil", season: 2, number: 1 },
        show: {
          title: "Record of Ragnarok",
          year: 2021,
          ids: {
            trakt: 171086,
            imdb: "tt13676344",
            tmdb: 114868,
            tvdb: 393810,
          },
        },
      },
      {
        // A rewatch of the same episode, later.
        watched_at: "2026-07-15T10:00:00.000Z",
        type: "episode",
        episode: { title: "Good vs. Evil", season: 2, number: 1 },
        show: {
          title: "Record of Ragnarok",
          year: 2021,
          ids: {
            trakt: 171086,
            imdb: "tt13676344",
            tmdb: 114868,
            tvdb: 393810,
          },
        },
      },
      {
        watched_at: "2026-07-01T20:50:00.000Z",
        type: "episode",
        episode: { title: "The Indomitable War God", season: 2, number: 2 },
        show: {
          title: "Record of Ragnarok",
          year: 2021,
          ids: {
            trakt: 171086,
            imdb: "tt13676344",
            tmdb: 114868,
            tvdb: 393810,
          },
        },
      },
    ];

    const shows = buildImportShows(history, []);

    expect(shows).toEqual([
      {
        title: "Record of Ragnarok",
        externalIds: { tmdb: "114868", tvdb: "393810", imdb: "tt13676344" },
        favorite: false,
        rating: null,
        episodes: [
          {
            season: 2,
            episode: 1,
            sourceEpisodeId: "2x1",
            watchedAt: new Date("2026-07-01T20:49:00.000Z"),
            totalWatches: 2,
          },
          {
            season: 2,
            episode: 2,
            sourceEpisodeId: "2x2",
            watchedAt: new Date("2026-07-01T20:50:00.000Z"),
            totalWatches: 1,
          },
        ],
      },
    ]);
  });

  it("ignores movie entries and adds watchlist-only shows with no episodes", () => {
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-06-27T17:46:00.000Z",
        type: "movie",
        movie: { title: "Backrooms", year: 2026, ids: { trakt: 870815 } },
      },
    ];
    const watchlist: TraktWatchlistEntry[] = [
      {
        type: "show",
        show: { title: "Planned Show", year: 2024, ids: { trakt: 5 } },
      },
    ];

    const shows = buildImportShows(history, watchlist);

    expect(shows).toEqual([
      {
        title: "Planned Show",
        externalIds: { tmdb: undefined, tvdb: undefined, imdb: undefined },
        favorite: false,
        rating: null,
        episodes: [],
      },
    ]);
  });

  it("does not duplicate a show already watched when it also sits on the watchlist", () => {
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-07-01T20:49:00.000Z",
        type: "episode",
        episode: { title: "Ep 1", season: 1, number: 1 },
        show: { title: "Show", year: 2020, ids: { trakt: 1 } },
      },
    ];
    const watchlist: TraktWatchlistEntry[] = [
      { type: "show", show: { title: "Show", year: 2020, ids: { trakt: 1 } } },
    ];

    const shows = buildImportShows(history, watchlist);

    expect(shows).toHaveLength(1);
    expect(shows[0].episodes).toHaveLength(1);
  });
});

describe("buildImportMovies", () => {
  it("marks a movie with a history entry as watched, folding repeat watches into rewatchedAt", () => {
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-06-27T17:46:00.000Z",
        type: "movie",
        movie: {
          title: "Backrooms",
          year: 2026,
          ids: { trakt: 870815, imdb: "tt26657236", tmdb: 1083381 },
        },
      },
      {
        watched_at: "2026-07-10T00:00:00.000Z",
        type: "movie",
        movie: {
          title: "Backrooms",
          year: 2026,
          ids: { trakt: 870815, imdb: "tt26657236", tmdb: 1083381 },
        },
      },
    ];

    const movies = buildImportMovies(history, []);

    expect(movies).toEqual([
      {
        title: "Backrooms",
        year: 2026,
        watched: true,
        // Earliest of the two watch events becomes watchedAt, the later one
        // a rewatch — not deduped away, unlike the show/episode case above.
        watchedAt: new Date("2026-06-27T17:46:00.000Z"),
        rewatchedAt: [new Date("2026-07-10T00:00:00.000Z")],
        externalIds: { tmdb: "1083381", tvdb: undefined, imdb: "tt26657236" },
        favorite: false,
        rating: null,
      },
    ]);
  });

  it("adds a watchlist-only movie as not watched, with no watch date", () => {
    const watchlist: TraktWatchlistEntry[] = [
      {
        type: "movie",
        movie: { title: "Dune", year: 2021, ids: { trakt: 99 } },
      },
    ];

    const movies = buildImportMovies([], watchlist);

    expect(movies[0]).toMatchObject({
      title: "Dune",
      watched: false,
      watchedAt: null,
      rewatchedAt: [],
    });
  });

  it("marks a movie as favorited and carries its rating", () => {
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-06-27T17:46:00.000Z",
        type: "movie",
        movie: { title: "Dune", year: 2021, ids: { trakt: 99 } },
      },
    ];

    const movies = buildImportMovies(
      history,
      [],
      [
        {
          type: "movie",
          movie: { title: "Dune", year: 2021, ids: { trakt: 99 } },
        },
      ],
      [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 9,
          type: "movie",
          movie: { title: "Dune", year: 2021, ids: { trakt: 99 } },
        },
      ],
    );

    expect(movies[0]).toMatchObject({ favorite: true, rating: 9 });
  });
});
