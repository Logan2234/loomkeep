import { describe, expect, it } from "vitest";
import {
  isSessionPaused,
  MAX_SESSION_DURATION_MINUTES,
  timerMinutes,
} from "./session";

describe("timerMinutes", () => {
  it.each([
    [0, 1],
    [1, 1],
    [60, 1],
    [61, 2],
    [600000, MAX_SESSION_DURATION_MINUTES],
  ])(
    "converts %i seconds to %i minutes within the session bounds",
    (seconds, expected) => expect(timerMinutes(seconds)).toBe(expected),
  );
});

describe("isSessionPaused", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");

  it("classifies active works from their latest dated session", () => {
    expect(
      isSessionPaused(
        {
          status: "PLAYING",
          lastSessionAt: "2026-08-20T12:00:00.000Z",
        },
        "PLAYING",
        now,
      ),
    ).toBe(true);
    expect(
      isSessionPaused(
        {
          status: "PLAYING",
          lastSessionAt: "2026-09-20T12:00:00.000Z",
        },
        "PLAYING",
        now,
      ),
    ).toBe(false);
  });

  it("does not pause works without a session or outside the active status", () => {
    expect(
      isSessionPaused(
        { status: "PLAYING", lastSessionAt: null },
        "PLAYING",
        now,
      ),
    ).toBe(false);
    expect(
      isSessionPaused(
        {
          status: "COMPLETED",
          lastSessionAt: "2026-01-01T12:00:00.000Z",
        },
        "PLAYING",
        now,
      ),
    ).toBe(false);
  });
});
