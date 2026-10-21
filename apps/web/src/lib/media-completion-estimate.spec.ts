import type {
  MediaDetailEpisodeDto,
  MediaDetailSeasonDto,
} from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { mediaCompletionEstimate } from "./media-completion-estimate";

const now = new Date("2026-10-22T12:00:00Z");

function episode(
  number: number,
  dates: (string | null)[] = [],
): MediaDetailEpisodeDto {
  return {
    id: `e${number}`,
    number,
    title: null,
    airDate: "2026-01-01",
    runtimeMin: 60,
    overview: null,
    stillUrl: null,
    voteAverage: null,
    voteCount: null,
    streamingUrl: null,
    streamingSite: null,
    reviewCount: null,
    reviewAverage: null,
    myRating: null,
    watchCount: dates.length,
    watches: dates.map((watchedAt, index) => ({
      id: `w${number}-${index}`,
      episodeId: `e${number}`,
      watchedAt,
    })),
  };
}

function season(
  number: number,
  episodes: MediaDetailEpisodeDto[],
): MediaDetailSeasonDto {
  return {
    id: `s${number}`,
    number,
    title: null,
    overview: null,
    posterUrl: null,
    airDate: null,
    voteAverage: null,
    reviewCount: null,
    reviewAverage: null,
    myRating: null,
    episodes,
  };
}

const watched = [1, 8, 15].map((day, index) =>
  episode(index + 1, [`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`]),
);

describe("mediaCompletionEstimate", () => {
  it("estimates aired regular episodes and ignores specials, future episodes and rewatches", () => {
    const detail = {
      type: "SERIES" as const,
      runtimeMin: 60,
      seasons: [
        season(0, [episode(1), episode(2, ["2026-10-21T12:00:00Z"])]),
        season(1, [
          ...watched,
          episode(4),
          episode(5),
          episode(6),
          { ...episode(7), airDate: "2026-11-01" },
          episode(8, ["2026-10-21T12:00:00Z", "2026-01-01T12:00:00Z"]),
        ]),
      ],
    };
    expect(mediaCompletionEstimate(detail, "UTC", now)).toBe("2026-11-13");
  });

  it("does not invent dates for undated imported watches", () => {
    const detail = {
      type: "SERIES" as const,
      runtimeMin: 60,
      seasons: [
        season(1, [watched[0], watched[1], episode(3, [null]), episode(4)]),
      ],
    };
    expect(mediaCompletionEstimate(detail, "UTC", now)).toBeNull();
  });

  it("hides the estimate when caught up", () => {
    expect(
      mediaCompletionEstimate(
        { type: "SERIES", runtimeMin: 60, seasons: [season(1, watched)] },
        "UTC",
        now,
      ),
    ).toBeNull();
  });

  it("uses the existing anime runtime fallback when durations are unknown", () => {
    const episodes = [...watched, episode(4)].map((value) => ({
      ...value,
      runtimeMin: null,
    }));
    expect(
      mediaCompletionEstimate(
        { type: "ANIME", runtimeMin: null, seasons: [season(1, episodes)] },
        "UTC",
        now,
      ),
    ).toBe("2026-10-30");
  });
});
