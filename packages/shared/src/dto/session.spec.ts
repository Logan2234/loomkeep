import { describe, expect, it } from "vitest";
import { isSessionPaused } from "./session";

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
