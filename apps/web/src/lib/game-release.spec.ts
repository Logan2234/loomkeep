import { m } from "#lib/paraglide/messages.js";
import { describe, expect, it } from "vitest";
import { gameReleaseLabel } from "./game-release";

describe("gameReleaseLabel", () => {
  it("says as much of the release as IGDB knows", () => {
    expect(gameReleaseLabel("2027-10-01T00:00:00.000Z", "QUARTER")).toBe(
      m.game_release_quarter({ quarter: 4, year: 2027 }),
    );
    expect(gameReleaseLabel("2028-01-01T00:00:00.000Z", "YEAR")).toBe(
      m.game_release_year({ year: 2028 }),
    );
    expect(gameReleaseLabel(null, "TBD")).toBe(m.game_release_tbd());
    expect(gameReleaseLabel(null, null)).toBeNull();
  });

  it("dates a known day, a month by its name", () => {
    expect(gameReleaseLabel("2026-11-19T00:00:00.000Z", "DAY")).toContain(
      m.media_release_expected(),
    );
    expect(gameReleaseLabel("2027-03-01T00:00:00.000Z", "MONTH")).not.toContain(
      "01",
    );
  });
});
