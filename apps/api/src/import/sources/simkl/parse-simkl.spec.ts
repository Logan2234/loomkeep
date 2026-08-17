import { buildImportMovies, buildImportShows } from "./parse-simkl";
import type { SimklAllItemsResponse } from "./simkl-api.types";

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
        externalIds: { tmdb: "238", tvdb: undefined, imdb: "tt0068646" },
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

  it("treats a dropped movie as watched (it was started)", () => {
    const data: SimklAllItemsResponse = {
      movies: [
        {
          status: "dropped",
          movie: { title: "Some Movie", year: 2019, ids: { simkl: 5 } },
        },
      ],
    };

    expect(buildImportMovies(data)[0].watched).toBe(true);
  });
});
