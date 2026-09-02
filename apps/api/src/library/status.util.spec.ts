import { deriveStatus } from "./status.util";

// normalizeAiringFinished (re-exported here from catalog/airing-status.util)
// is covered by catalog/airing-status.util.spec.ts — no need to duplicate
// its cases against this module's own re-export.

describe("deriveStatus", () => {
  const progress = (watched: number, total: number) => ({
    watchedEpisodes: watched,
    totalEpisodes: total,
    nextEpisode: null,
  });

  describe("manual overrides win", () => {
    it("keeps DROPPED even when everything is watched", () => {
      expect(deriveStatus("ANIME", progress(12, 12), true, "DROPPED")).toBe(
        "DROPPED",
      );
    });
    it("keeps DROPPED even when episodes are partially watched", () => {
      expect(deriveStatus("SERIES", progress(3, 10), false, "DROPPED")).toBe(
        "DROPPED",
      );
    });
  });

  describe("movies", () => {
    it("is COMPLETED when stored status is COMPLETED (seen)", () => {
      expect(deriveStatus("MOVIE", null, false, "COMPLETED")).toBe("COMPLETED");
    });
    it("is PLANNED otherwise (never seen / stale WATCHING)", () => {
      expect(deriveStatus("MOVIE", null, false, "PLANNED")).toBe("PLANNED");
      expect(deriveStatus("MOVIE", null, false, "WATCHING")).toBe("PLANNED");
    });
  });

  describe("series / anime", () => {
    it("is PLANNED with no episodes listed", () => {
      expect(deriveStatus("SERIES", null, false, "WATCHING")).toBe("PLANNED");
      expect(deriveStatus("SERIES", progress(0, 0), false, "WATCHING")).toBe(
        "PLANNED",
      );
    });
    it("is PLANNED when nothing is watched", () => {
      expect(deriveStatus("SERIES", progress(0, 10), false, "WATCHING")).toBe(
        "PLANNED",
      );
    });
    it("is WATCHING when partially watched", () => {
      expect(deriveStatus("ANIME", progress(4, 12), false, "PLANNED")).toBe(
        "WATCHING",
      );
    });
    it("is UP_TO_DATE when fully watched but still airing", () => {
      expect(deriveStatus("SERIES", progress(10, 10), false, "PLANNED")).toBe(
        "UP_TO_DATE",
      );
    });
    it("is COMPLETED when fully watched and finished airing", () => {
      expect(deriveStatus("SERIES", progress(10, 10), true, "PLANNED")).toBe(
        "COMPLETED",
      );
    });
  });
});
