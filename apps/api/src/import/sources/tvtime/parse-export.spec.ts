import { parseTvTimeExport } from "./parse-export";

// Minimal headers mirroring the real TV Time files (only the columns the parser
// reads need to be present).
const EPISODES_HEADER =
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at";
const REWATCHED_HEADER = "episode_id,cpt";
const SHOWS_HEADER = "tv_show_name,tv_show_id,nb_episodes_seen";
const RECORDS_HEADER = "type,entity_type,movie_name,release_date,created_at";

describe("parseTvTimeExport", () => {
  it("groups watched episodes per show and dedups the repeated rows", () => {
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
      "Doctor Who,295295,1,2,78804,fill-previous,2023-12-29 01:07:03", // dup episode
      "Doctor Who,295298,1,5,78804,,2024-01-02 10:00:00",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv });

    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({ tvdbId: "78804", name: "Doctor Who" });
    expect(shows[0].episodes).toHaveLength(2);
    const ep2 = shows[0].episodes.find((e) => e.episode === 2)!;
    expect(ep2.season).toBe(1);
    expect(ep2.totalWatches).toBe(1);
    // Earliest of the two duplicate rows wins.
    expect(ep2.watchedAt?.toISOString()).toBe("2023-12-29T01:07:02.000Z");
  });

  it("folds rewatch counts into totalWatches (base + cpt)", () => {
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");
    const rewatchedCsv = [REWATCHED_HEADER, "295295,2"].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, rewatchedCsv });

    expect(shows[0].episodes[0].totalWatches).toBe(3); // 1 + 2 rewatches
  });

  it("counts season-bulk-marked rows as watched episodes", () => {
    // `bulk_type` only records HOW a watch was entered (individually /
    // fill-previous / whole-season) — a `season` row is a real watched
    // episode, not a summary to skip.
    const episodesCsv = [
      EPISODES_HEADER,
      "Sakamoto Days,10501942,1,1,423732,,2025-12-22 20:16:37",
      "Sakamoto Days,10842955,1,20,423732,season,2025-12-26 17:44:02",
      "Sakamoto Days,10842956,1,21,423732,season,2025-12-26 17:44:02",
      "Sakamoto Days,10842957,1,22,423732,season,2025-12-26 17:44:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv });

    expect(
      shows[0].episodes.map((e) => e.episode).sort((a, b) => a - b),
    ).toEqual([1, 20, 21, 22]);
  });

  it("adds never-started followed shows as empty watchlist entries", () => {
    const showsCsv = [
      SHOWS_HEADER,
      "Watched Show,78804,5",
      "Planned Show,12345,0",
    ].join("\n");
    const episodesCsv = [
      EPISODES_HEADER,
      "Watched Show,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, showsCsv });

    const planned = shows.find((s) => s.tvdbId === "12345")!;
    expect(planned.name).toBe("Planned Show");
    expect(planned.episodes).toHaveLength(0);
  });

  it("prefers the show name from user_tv_show_data over the v2 series_name", () => {
    const showsCsv = [SHOWS_HEADER, "Doctor Who (2005),78804,5"].join("\n");
    const episodesCsv = [
      EPISODES_HEADER,
      "Doctor Who,295295,1,2,78804,,2023-12-29 01:07:02",
    ].join("\n");

    const { shows } = parseTvTimeExport({ episodesCsv, showsCsv });

    expect(shows[0].name).toBe("Doctor Who (2005)");
  });

  it("classifies movies as watched or watchlist, parsing the year and watch date", () => {
    const recordsCsv = [
      RECORDS_HEADER,
      "follow,movie,The Batman,2022-03-02 00:00:00,2022-01-01 00:00:00",
      // Same movie, now watched — release_date unchanged, created_at is the
      // approximate watch-date signal (watch_date itself is never populated
      // for movies in the real export).
      "watch,movie,The Batman,2022-03-02 00:00:00,2022-04-10 12:00:00",
      "towatch,movie,Dune,2021-09-15 00:00:00,",
      "follow,episode,Not A Movie,,", // ignored (wrong entity_type)
    ].join("\n");

    const { movies } = parseTvTimeExport({ recordsCsv });

    expect(movies).toHaveLength(2);
    const batman = movies.find((m) => m.title === "The Batman")!;
    expect(batman).toEqual({
      title: "The Batman",
      year: 2022,
      watched: true,
      watchedAt: new Date("2022-04-10T12:00:00.000Z"),
    });
    const dune = movies.find((m) => m.title === "Dune")!;
    expect(dune).toEqual({
      title: "Dune",
      year: 2021,
      watched: false,
      watchedAt: null,
    });
  });
});
