import { describe, expect, it } from "vitest";
import { expiresAtFor, expiryState, minCustomDate } from "./api-key-form";

const NOW = new Date(2026, 9, 1, 12, 0, 0);

describe("expiresAtFor", () => {
  it("adds the chosen number of days", () => {
    expect(expiresAtFor("30", "", NOW)).toBe(
      new Date(NOW.getTime() + 30 * 86_400_000).toISOString(),
    );
  });

  it("sends null for a key that never expires", () => {
    expect(expiresAtFor("never", "2027-01-01", NOW)).toBeNull();
  });

  it("ends a custom date at the last second of that day", () => {
    expect(expiresAtFor("custom", "2027-01-31", NOW)).toBe(
      new Date(2027, 0, 31, 23, 59, 59).toISOString(),
    );
  });
});

describe("minCustomDate", () => {
  it("offers tomorrow at the earliest", () => {
    expect(minCustomDate(NOW)).toBe("2026-10-02");
  });
});

describe("expiryState", () => {
  const inDays = (days: number) =>
    new Date(NOW.getTime() + days * 86_400_000).toISOString();

  it.each([
    [null, "never"],
    [inDays(30), "active"],
    [inDays(6), "soon"],
    [inDays(-1), "expired"],
  ] as const)("classifies %s as %s", (expiresAt, state) => {
    expect(expiryState({ expiresAt }, NOW)).toBe(state);
  });
});
