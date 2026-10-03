import { describe, expect, it } from "vitest";
import { movieReleaseInfo } from "./movie-release";

const now = new Date("2026-10-03T12:00:00Z");
describe("movie release availability", () => {
  it("ignores premieres and unlocks at the first public worldwide release", () => {
    const dates = [
      { country: "US", date: "2026-10-01", type: 1 },
      { country: "US", date: "2026-10-04", type: 2 },
      { country: "FR", date: "2026-10-07", type: 3 },
    ];
    expect(movieReleaseInfo(dates, "Released", "FR", now)).toMatchObject({
      upcoming: true,
      publicDate: "2026-10-04",
      localDate: "2026-10-07",
      localType: "cinema",
    });
    expect(
      movieReleaseInfo(dates, "Post Production", "FR", new Date("2026-10-04")),
    ).toMatchObject({ upcoming: false });
  });
  it("prefers local cinema over an earlier digital release", () => {
    expect(
      movieReleaseInfo(
        [
          { country: "FR", date: "2026-11-01", type: 3 },
          { country: "FR", date: "2026-10-02", type: 4 },
        ],
        "Released",
        "FR",
        now,
      ),
    ).toMatchObject({
      upcoming: false,
      localDate: "2026-11-01",
      localType: "cinema",
    });
  });
  it("uses digital only when no local cinema release is announced", () => {
    expect(
      movieReleaseInfo(
        [{ country: "FR", date: "2026-11-01", type: 4 }],
        "Planned",
        "FR",
        now,
      ),
    ).toMatchObject({ localDate: "2026-11-01", localType: "digital" });
  });
  it("does not substitute a worldwide release for an unknown local date", () => {
    expect(
      movieReleaseInfo(
        [{ country: "US", date: "2026-11-01", type: 3 }],
        "Planned",
        "FR",
        now,
      ),
    ).toMatchObject({ upcoming: true, localDate: null, localType: null });
  });
  it("uses production status when dates are unknown without blocking already released films", () => {
    expect(movieReleaseInfo([], "Post Production", "FR", now).upcoming).toBe(
      true,
    );
    expect(movieReleaseInfo([], "Released", "FR", now).upcoming).toBe(false);
    expect(movieReleaseInfo([], null, "FR", now).upcoming).toBe(false);
  });
});
