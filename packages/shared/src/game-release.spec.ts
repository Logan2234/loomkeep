import { describe, expect, it } from "vitest";
import { gameReleaseAlertDay, isGameUpcoming } from "./game-release";

const now = new Date("2026-10-04T12:00:00Z");

describe("game release", () => {
  it("is upcoming until its period begins", () => {
    expect(isGameUpcoming("2026-11-19", "DAY", now)).toBe(true);
    expect(isGameUpcoming("2026-10-04", "DAY", now)).toBe(false);
    // "October 2026" is out from the 1st, "2026" from January.
    expect(isGameUpcoming("2026-10-01", "MONTH", now)).toBe(false);
    expect(isGameUpcoming("2026-01-01", "YEAR", now)).toBe(false);
    expect(isGameUpcoming("2027-01-01", "YEAR", now)).toBe(true);
  });

  it("is upcoming when announced without a date, not when the date is unknown", () => {
    expect(isGameUpcoming(null, "TBD", now)).toBe(true);
    expect(isGameUpcoming(null, null, now)).toBe(false);
  });

  it("alerts on the day, or on a month's 1st, never on a vaguer date", () => {
    expect(gameReleaseAlertDay("2026-11-19", "DAY")).toBe("2026-11-19");
    expect(gameReleaseAlertDay("2027-03-01", "MONTH")).toBe("2027-03-01");
    expect(gameReleaseAlertDay("2027-10-01", "QUARTER")).toBeNull();
    expect(gameReleaseAlertDay("2028-01-01", "YEAR")).toBeNull();
    expect(gameReleaseAlertDay(null, "TBD")).toBeNull();
  });
});
