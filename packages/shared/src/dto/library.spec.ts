import { describe, expect, it } from "vitest";
import { GHOST_AFTER_DAYS, isDormant, isGhost } from "./library";

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
