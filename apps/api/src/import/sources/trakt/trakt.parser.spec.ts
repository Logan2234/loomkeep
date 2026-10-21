import type {
  TraktHistoryEntry,
  TraktWatchlistEntry,
} from "./trakt-export.types";
import { buildImportMovies, buildImportShows } from "./trakt.parser";

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
        seasonRatings: [],
        episodeRatings: [],
        addedAt: null,
        episodes: [
          {
            season: 2,
            episode: 1,
            sourceEpisodeId: "2x1",
            watchedAt: new Date("2026-07-01T20:49:00.000Z"),
            totalWatches: 2,
            rating: null,
          },
          {
            season: 2,
            episode: 2,
            sourceEpisodeId: "2x2",
            watchedAt: new Date("2026-07-01T20:50:00.000Z"),
            totalWatches: 1,
            rating: null,
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
        seasonRatings: [],
        episodeRatings: [],
        addedAt: null,
        episodes: [],
      },
    ]);
  });

  it("dates a watchlist show from when it was listed", () => {
    const shows = buildImportShows(
      [],
      [
        {
          listed_at: "2024-09-09T09:09:09.000Z",
          type: "show",
          show: { title: "Planned Show", year: 2024, ids: { trakt: 5 } },
        },
      ],
    );

    expect(shows[0].addedAt).toEqual(new Date("2024-09-09T09:09:09.000Z"));
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

  it("carries episode and season ratings, an unwatched episode's apart from the watches", () => {
    const show = { title: "Show", year: 2020, ids: { trakt: 1 } };
    const history: TraktHistoryEntry[] = [
      {
        watched_at: "2026-07-01T20:49:00.000Z",
        type: "episode",
        episode: { title: "Ep 1", season: 1, number: 1 },
        show,
      },
    ];

    const shows = buildImportShows(history, [], [], {
      seasons: [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 7,
          type: "season",
          season: { number: 1 },
          show,
        },
      ],
      episodes: [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 9,
          type: "episode",
          episode: { title: "Ep 1", season: 1, number: 1 },
          show,
        },
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 6,
          type: "episode",
          episode: { title: "Ep 2", season: 1, number: 2 },
          show,
        },
      ],
    });

    expect(shows[0].episodes).toHaveLength(1);
    expect(shows[0].episodes[0].rating).toBe(9);
    expect(shows[0].episodeRatings).toEqual([
      { season: 1, episode: 2, rating: 6 },
    ]);
    expect(shows[0].seasonRatings).toEqual([{ season: 1, rating: 7 }]);
  });

  it("adds a show rated but never watched as a watchlist entry keeping its ratings", () => {
    const rated = { title: "Rated Show", year: 2020, ids: { trakt: 7 } };
    const seasonOnly = { title: "Season Show", year: 2021, ids: { trakt: 8 } };

    const shows = buildImportShows([], [], [], {
      shows: [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 8,
          type: "show",
          show: rated,
        },
      ],
      seasons: [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 6,
          type: "season",
          season: { number: 2 },
          show: seasonOnly,
        },
      ],
    });

    expect(shows).toEqual([
      expect.objectContaining({ title: "Rated Show", rating: 8, episodes: [] }),
      expect.objectContaining({
        title: "Season Show",
        rating: null,
        episodes: [],
        seasonRatings: [{ season: 2, rating: 6 }],
      }),
    ]);
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
        addedAt: null,
      },
    ]);
  });

  it("adds a watchlist-only movie as not watched, dated from when it was listed", () => {
    const watchlist: TraktWatchlistEntry[] = [
      {
        listed_at: "2025-05-05T12:00:00.000Z",
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
      addedAt: new Date("2025-05-05T12:00:00.000Z"),
    });
  });

  it("dates a watched movie from when it was listed, if it sits on the watchlist", () => {
    const dune = { title: "Dune", year: 2021, ids: { trakt: 99 } };
    const movies = buildImportMovies(
      [{ watched_at: "2026-01-01T00:00:00.000Z", type: "movie", movie: dune }],
      [{ listed_at: "2025-05-05T12:00:00.000Z", type: "movie", movie: dune }],
    );

    expect(movies[0].addedAt).toEqual(new Date("2025-05-05T12:00:00.000Z"));
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

  it("adds a movie rated but never watched as not watched, keeping its rating", () => {
    const movies = buildImportMovies(
      [],
      [],
      [],
      [
        {
          rated_at: "2026-08-01T00:00:00.000Z",
          rating: 7,
          type: "movie",
          movie: { title: "Nope", year: 2022, ids: { trakt: 601018 } },
        },
      ],
    );

    expect(movies).toEqual([
      expect.objectContaining({
        title: "Nope",
        year: 2022,
        watched: false,
        watchedAt: null,
        rating: 7,
      }),
    ]);
  });
});
