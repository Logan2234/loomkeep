import { describe, expect, it } from "vitest";
import { dailyPick, localDayNumber } from "./daily-pick";

const DAYS = 3_000;
const START = 20_000;

describe("dailyPick", () => {
  it("gives the same pick for the same day and seed", () => {
    expect(dailyPick(12, "user-1", START)).toBe(dailyPick(12, "user-1", START));
  });

  it("never shows the same work two days in a row", () => {
    for (let n = 2; n <= 15; n++) {
      for (let day = START; day < START + DAYS; day++) {
        expect(dailyPick(n, "user-1", day)).not.toBe(
          dailyPick(n, "user-1", day - 1),
        );
      }
    }
  });

  it("shows every work once per cycle of n days", () => {
    const n = 9;
    const cycleStart = Math.ceil(START / n) * n;
    const picks = Array.from({ length: n }, (_, i) =>
      dailyPick(n, "user-1", cycleStart + i),
    );

    expect(new Set(picks).size).toBe(n);
  });

  it("picks differently for different users", () => {
    const picks = (seed: string) =>
      Array.from({ length: 30 }, (_, i) => dailyPick(20, seed, START + i));

    expect(picks("user-1")).not.toEqual(picks("user-2"));
  });

  it("stays in range, and has nothing to pick from an empty list", () => {
    for (let day = START; day < START + 200; day++) {
      const pick = dailyPick(7, "user-1", day);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(7);
    }

    expect(dailyPick(0, "user-1", START)).toBe(-1);
    expect(dailyPick(1, "user-1", START)).toBe(0);
  });
});

describe("localDayNumber", () => {
  it("counts calendar days, whatever the time of day", () => {
    const morning = new Date(2026, 8, 25, 0, 5);
    const night = new Date(2026, 8, 25, 23, 55);

    expect(localDayNumber(morning)).toBe(localDayNumber(night));
    expect(localDayNumber(new Date(2026, 8, 26, 0, 1))).toBe(
      localDayNumber(night) + 1,
    );
  });
});
