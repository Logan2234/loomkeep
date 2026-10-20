import { earlierOf, parseDateOrNull } from "./import-date.util";

describe("import dates", () => {
  it("preserves an explicit offset and rejects missing or invalid dates", () => {
    expect(parseDateOrNull("2026-01-01T00:30:00+02:00")?.toISOString()).toBe(
      "2025-12-31T22:30:00.000Z",
    );

    for (const value of [undefined, "", "not a date"]) {
      expect(parseDateOrNull(value)).toBeNull();
    }
  });

  it("keeps the earlier known date, including missing sides and ties", () => {
    const early = new Date("2026-01-01T00:00:00Z");
    const late = new Date("2026-02-01T00:00:00Z");
    expect(earlierOf(late, early)).toBe(early);
    expect(earlierOf(early, late)).toBe(early);
    expect(earlierOf(null, early)).toBe(early);
    expect(earlierOf(early, null)).toBe(early);
    expect(earlierOf(null, null)).toBeNull();
    expect(earlierOf(new Date(early), early)).toBe(early);
  });
});
