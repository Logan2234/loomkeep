import { describe, expect, it } from "vitest";
import {
  GHOST_AFTER_DAYS,
  episodeCode,
  isDormant,
  isGhost,
  progressPercent,
} from "./library";

describe("episodeCode", () => {
  it.each([
    [0, 1, "S00E01"],
    [2, 5, "S02E05"],
    [10, 105, "S10E105"],
  ])("formats season %i episode %i as %s", (season, episode, expected) => {
    expect(episodeCode(season, episode)).toBe(expected);
  });
});

describe("progressPercent", () => {
  it("returns zero without episodes to count", () => {
    expect(progressPercent(null)).toBe(0);
    expect(progressPercent(undefined)).toBe(0);
    expect(progressPercent({ watchedEpisodes: 0, totalEpisodes: 0 })).toBe(0);
  });

  it.each([
    [0, 3, 0],
    [1, 3, 33],
    [2, 3, 67],
    [3, 3, 100],
    [4, 3, 133],
  ])(
    "rounds %i of %i episodes to %i percent",
    (watchedEpisodes, totalEpisodes, expected) => {
      expect(progressPercent({ watchedEpisodes, totalEpisodes })).toBe(
        expected,
      );
    },
  );
});

describe("isGhost", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  const watchedDaysAgo = (days: number) => ({
    status: "WATCHING" as const,
    lastWatchedAt: new Date(now.getTime() - days * 86_400_000).toISOString(),
  });

  it("turns a show left alone for six months into a ghost, still dormant", () => {
    const entry = watchedDaysAgo(GHOST_AFTER_DAYS);

    expect(isGhost(entry, now)).toBe(true);
    expect(isDormant(entry, now)).toBe(true);
  });

  it("leaves a show paused for a few months a plain dormant one", () => {
    const entry = watchedDaysAgo(GHOST_AFTER_DAYS - 1);

    expect(isGhost(entry, now)).toBe(false);
    expect(isDormant(entry, now)).toBe(true);
  });

  it("never haunts a show that isn't in progress or was never watched", () => {
    const old = watchedDaysAgo(400);

    expect(isGhost({ ...old, status: "COMPLETED" }, now)).toBe(false);
    expect(isGhost({ status: "WATCHING", lastWatchedAt: null }, now)).toBe(
      false,
    );
  });
});
