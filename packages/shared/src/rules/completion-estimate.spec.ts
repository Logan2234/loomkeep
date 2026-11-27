import { describe, expect, it } from "vitest";
import { estimateCompletionDate } from "./completion-estimate";

const now = new Date("2026-10-22T12:00:00Z");
const activity = [1, 8, 15].map((day) => ({
  occurredAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
  minutes: 60,
}));

describe("estimateCompletionDate", () => {
  it("includes inactive days and the days since the last activity", () => {
    expect(estimateCompletionDate(180, activity, "UTC", now)).toBe(
      "2026-11-13",
    );
  });

  it("requires three distinct active days", () => {
    expect(
      estimateCompletionDate(
        180,
        [...activity.slice(0, 2), activity[0]],
        "UTC",
        now,
      ),
    ).toBeNull();
  });

  it("ignores old and future activity and zero durations", () => {
    const ignored = [
      { occurredAt: "2026-09-22T12:00:00Z", minutes: 9000 },
      { occurredAt: "2026-10-23T12:00:00Z", minutes: 9000 },
      { occurredAt: "2026-10-22T10:00:00Z", minutes: 0 },
    ];
    expect(
      estimateCompletionDate(180, [...activity, ...ignored], "UTC", now),
    ).toBe("2026-11-13");
  });

  it.each([null, 0, -1])(
    "hides estimates without positive remaining time (%s)",
    (remaining) => {
      expect(
        estimateCompletionDate(remaining, activity, "UTC", now),
      ).toBeNull();
    },
  );

  it("counts local calendar days across the daylight-saving change", () => {
    const samples = [
      { occurredAt: "2026-10-23T22:30:00Z", minutes: 60 },
      { occurredAt: "2026-10-24T22:30:00Z", minutes: 60 },
      { occurredAt: "2026-10-25T23:30:00Z", minutes: 60 },
    ];
    expect(
      estimateCompletionDate(
        180,
        samples,
        "Europe/Paris",
        new Date("2026-10-26T23:30:00Z"),
      ),
    ).toBe("2026-10-31");
  });

  it("falls back to UTC for an invalid user timezone", () => {
    expect(estimateCompletionDate(180, activity, "Not/AZone", now)).toBe(
      "2026-11-13",
    );
  });
});
