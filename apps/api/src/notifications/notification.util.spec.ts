import {
  selectNewEpisodeNotifications,
  type CandidateEpisode,
} from "./notification.util";

const base: Omit<CandidateEpisode, "episodeId" | "airDate"> = {
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  seasonFinale: false,
  mediaTitle: "My Show",
  mediaType: "SERIES",
  sourceId: "500",
  // Long before any test air date, so existing tests aren't affected by the
  // "aired after tracking started" gate — see the dedicated describe below.
  trackedSince: new Date("2020-01-01T00:00:00Z"),
};

describe("selectNewEpisodeNotifications", () => {
  const now = new Date("2026-07-06T12:00:00Z");
  const since = new Date("2026-06-22T12:00:00Z"); // 14 days earlier

  it("keeps only episodes aired within (since, now], mapped to payloads", () => {
    const candidates: CandidateEpisode[] = [
      {
        ...base,
        episodeId: "recent",
        airDate: new Date("2026-07-05T00:00:00Z"),
      },
      { ...base, episodeId: "old", airDate: new Date("2026-01-01T00:00:00Z") },
      {
        ...base,
        episodeId: "future",
        airDate: new Date("2026-07-20T00:00:00Z"),
      },
    ];

    const result = selectNewEpisodeNotifications(candidates, {
      since,
      now,
      alreadyNotified: new Set(),
    });

    expect(result.map((n) => n.episodeId)).toEqual(["recent"]);
    expect(result[0]).toEqual({
      episodeId: "recent",
      mediaTitle: "My Show",
      mediaType: "SERIES",
      sourceId: "500",
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: "Pilot",
      seasonFinale: false,
      airDate: new Date("2026-07-05T00:00:00Z"),
    });
  });

  it("skips episodes already notified", () => {
    const candidates: CandidateEpisode[] = [
      { ...base, episodeId: "a", airDate: new Date("2026-07-05T00:00:00Z") },
      { ...base, episodeId: "b", airDate: new Date("2026-07-04T00:00:00Z") },
    ];

    const result = selectNewEpisodeNotifications(candidates, {
      since,
      now,
      alreadyNotified: new Set(["a"]),
    });

    expect(result.map((n) => n.episodeId)).toEqual(["b"]);
  });

  it("excludes an episode aired exactly at the window start (exclusive)", () => {
    const result = selectNewEpisodeNotifications(
      [{ ...base, episodeId: "edge", airDate: since }],
      { since, now, alreadyNotified: new Set() },
    );
    expect(result).toEqual([]);
  });

  describe("freshly-tracked shows", () => {
    it("excludes an episode that aired before the user started tracking (e.g. importing an already-finished show)", () => {
      const trackedSince = new Date("2026-07-05T12:00:00Z");
      const result = selectNewEpisodeNotifications(
        [
          {
            ...base,
            episodeId: "finale",
            // Aired inside the window, but before this user added the show.
            airDate: new Date("2026-07-04T00:00:00Z"),
            trackedSince,
          },
        ],
        { since, now, alreadyNotified: new Set() },
      );
      expect(result).toEqual([]);
    });

    it("still notifies an episode that airs after tracking started", () => {
      const trackedSince = new Date("2026-07-01T00:00:00Z");
      const result = selectNewEpisodeNotifications(
        [
          {
            ...base,
            episodeId: "new-ep",
            airDate: new Date("2026-07-05T00:00:00Z"),
            trackedSince,
          },
        ],
        { since, now, alreadyNotified: new Set() },
      );
      expect(result.map((n) => n.episodeId)).toEqual(["new-ep"]);
    });
  });
});
