import { describe, expect, it } from "vitest";
import { localDayBoundary } from "./admin-user-filters";

describe("localDayBoundary", () => {
  it("uses the next local midnight as an exclusive end", () => {
    expect(localDayBoundary("2026-03-29", true)).toBe(
      new Date(2026, 2, 30).toISOString(),
    );
  });

  it("ignores malformed or impossible calendar dates", () => {
    expect(localDayBoundary("2026-02-30")).toBeUndefined();
    expect(localDayBoundary("2026-2-3")).toBeUndefined();
  });
});
