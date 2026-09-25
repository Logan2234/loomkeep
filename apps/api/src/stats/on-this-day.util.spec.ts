import type { OnThisDayEntryDto } from "@loomkeep/shared";
import { anniversaryWindow, rankByAnniversary } from "./on-this-day.util";

describe("anniversaryWindow", () => {
  it("spans the week around the same day a year earlier", () => {
    const { center, from, to } = anniversaryWindow("2026-09-25");

    expect(center.toISOString()).toBe("2025-09-25T00:00:00.000Z");
    expect(from.toISOString()).toBe("2025-09-22T00:00:00.000Z");
    expect(to.toISOString()).toBe("2025-09-29T00:00:00.000Z");
  });

  it("falls back to 28 February from a leap day", () => {
    expect(anniversaryWindow("2028-02-29").center.toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
  });
});

describe("rankByAnniversary", () => {
  const entry = (title: string, date: string): OnThisDayEntryDto => ({
    domain: "MEDIA",
    title,
    imageUrl: null,
    href: null,
    kind: "watched",
    date,
    count: 1,
  });

  it("puts what happened closest to the anniversary first", () => {
    const center = new Date("2025-09-25T00:00:00Z");

    const ranked = rankByAnniversary(
      [
        entry("far", "2025-09-22T10:00:00Z"),
        entry("exact", "2025-09-25T09:00:00Z"),
        entry("near", "2025-09-26T20:00:00Z"),
      ],
      center,
    );

    expect(ranked.map((e) => e.title)).toEqual(["exact", "near", "far"]);
  });
});
