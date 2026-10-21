import type { SimklAllItemsResponse } from "./simkl-api.types";
import { buildImportMovies, buildImportShows } from "./simkl.parser";

describe("buildImportShows", () => {
  it("flattens watched seasons/episodes for a show", () => {
    const data: SimklAllItemsResponse = {
      shows: [
        {
          status: "watching",
          show: {
            title: "The Walking Dead",
            year: 2010,
            ids: { simkl: 2090, imdb: "tt1520211", tvdb: "153021" },
          },
          seasons: [
            {
              number: 1,
              episodes: [
                { number: 2, watched_at: "2026-05-15T00:32:20Z" },
                { number: 3, watched_at: "2026-05-15T00:32:21Z" },
              ],
            },
          ],
        },
      ],
    };

    expect(buildImportShows(data)).toEqual([
      {
        title: "The Walking Dead",
        externalIds: { tmdb: undefined, tvdb: "153021", imdb: "tt1520211" },
        episodes: [
          {
            season: 1,
            episode: 2,
            sourceEpisodeId: "1x2",
            watchedAt: new Date("2026-05-15T00:32:20Z"),
            totalWatches: 1,
          },
          {
            season: 1,
            episode: 3,
            sourceEpisodeId: "1x3",
            watchedAt: new Date("2026-05-15T00:32:21Z"),
            totalWatches: 1,
          },
        ],
        rating: null,
        notes: null,
        addedAt: null,
      },
    ]);
  });

  it("treats a watchlist-only entry (no seasons) as an empty-episode show", () => {
    const data: SimklAllItemsResponse = {
      shows: [
        {
          status: "plantowatch",
          show: { title: "Charmed", year: 1998, ids: { simkl: 297 } },
        },
      ],
    };

    expect(buildImportShows(data)).toEqual([
      {
        title: "Charmed",
        externalIds: { tmdb: undefined, tvdb: undefined, imdb: undefined },
        episodes: [],
        rating: null,
        notes: null,
        addedAt: null,
      },
    ]);
  });

  it("merges the anime bucket into the same show list", () => {
    const data: SimklAllItemsResponse = {
      shows: [
        {
          status: "completed",
          show: { title: "Show", year: 2020, ids: { simkl: 1 } },
        },
      ],
      anime: [
        {
          status: "completed",
          show: {
            title: "Cowboy Bebop",
            year: 1998,
            ids: { simkl: 37089, mal: "1", anilist: "1" },
          },
          seasons: [
            {
              number: 1,
              episodes: [{ number: 1, watched_at: "2026-05-15T00:13:09Z" }],
            },
          ],
        },
      ],
    };

    const shows = buildImportShows(data);
    expect(shows).toHaveLength(2);
    expect(shows.find((s) => s.title === "Cowboy Bebop")).toMatchObject({
      externalIds: { anilist: "1" },
      episodes: [expect.objectContaining({ season: 1, episode: 1 })],
    });
  });
});

describe("buildImportMovies", () => {
  it("marks a completed movie as watched", () => {
    const data: SimklAllItemsResponse = {
      movies: [
        {
          status: "completed",
          last_watched_at: "1994-09-01T16:00:00Z",
          movie: {
            title: "The Godfather",
            year: 1972,
            ids: { simkl: 53434, imdb: "tt0068646", tmdb: "238" },
          },
        },
      ],
    };

    expect(buildImportMovies(data)).toEqual([
      {
        title: "The Godfather",
        year: 1972,
        watched: true,
        watchedAt: new Date("1994-09-01T16:00:00Z"),
        rewatchedAt: [],
        externalIds: { tmdb: "238", tvdb: undefined, imdb: "tt0068646" },
        rating: null,
        notes: null,
        addedAt: null,
      },
    ]);
  });

  it("marks a plantowatch movie as not watched", () => {
    const data: SimklAllItemsResponse = {
      movies: [
        {
          status: "plantowatch",
          movie: {
            title: "Dune",
            year: 2021,
            ids: { simkl: 99, tmdb: "438631" },
          },
        },
      ],
    };

    expect(buildImportMovies(data)[0].watched).toBe(false);
  });

  it("keeps a dropped movie as dropped, not as watched", () => {
    const data: SimklAllItemsResponse = {
      movies: [
        {
          status: "dropped",
          last_watched_at: "2026-01-01T20:00:00Z",
          movie: { title: "Some Movie", year: 2019, ids: { simkl: 5 } },
        },
      ],
    };

    expect(buildImportMovies(data)[0]).toMatchObject({
      watched: false,
      watchedAt: null,
      status: "DROPPED",
    });
  });

  it("carries a movie's rating, memo and the date it was added", () => {
    const data: SimklAllItemsResponse = {
      movies: [
        {
          status: "plantowatch",
          user_rating: 7,
          added_to_watchlist_at: "2025-03-01T10:00:00Z",
          memo: { text: "Recommended by Sam", is_private: true },
          movie: { title: "Dune", year: 2021, ids: { simkl: 99 } },
        },
      ],
    };

    expect(buildImportMovies(data)[0]).toMatchObject({
      rating: 7,
      notes: "Recommended by Sam",
      addedAt: new Date("2025-03-01T10:00:00Z"),
    });
  });
});

describe("Simkl show statuses and extras", () => {
  it("states dropped and on-hold shows outright, and carries rating, memo and added date", () => {
    const show = (status: "dropped" | "hold" | "watching", simkl: number) => ({
      status,
      user_rating: simkl === 1 ? 9 : null,
      added_to_watchlist_at: simkl === 1 ? "2024-02-02T00:00:00Z" : null,
      memo: simkl === 1 ? { text: "  Rewatch with Alex  " } : {},
      show: { title: `Show ${simkl}`, year: 2020, ids: { simkl } },
    });

    const shows = buildImportShows({
      shows: [show("dropped", 1), show("hold", 2), show("watching", 3)],
    });

    expect(shows.map((s) => s.status)).toEqual([
      "DROPPED",
      "WATCHING",
      undefined,
    ]);
    expect(shows[0]).toMatchObject({
      rating: 9,
      notes: "Rewatch with Alex",
      addedAt: new Date("2024-02-02T00:00:00Z"),
    });
    expect(shows[1]).toMatchObject({
      rating: null,
      notes: null,
      addedAt: null,
    });
  });
});
