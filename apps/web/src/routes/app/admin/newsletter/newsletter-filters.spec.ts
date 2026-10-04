import { describe, expect, it } from "vitest";
import { filterNewsletterSends } from "./newsletter-filters";

describe("newsletter filters", () => {
  const sends = [
    { title: "Été 1.10", sentAt: new Date(2026, 9, 4, 23, 59).toISOString() },
    { title: "Version 1.9", sentAt: new Date(2026, 9, 3, 12).toISOString() },
    { title: "Été 1.11", sentAt: new Date(2026, 9, 5, 0, 0).toISOString() },
  ];
  it("matches accents and includes the whole selected local day", () => {
    expect(
      filterNewsletterSends(sends, {
        query: "ete",
        from: "2026-10-04",
        to: "2026-10-04",
      }),
    ).toEqual([sends[0]]);
  });
  it("returns no matches for an excluded period", () => {
    expect(
      filterNewsletterSends(sends, { query: "", from: "2026-10-06", to: "" }),
    ).toEqual([]);
  });
});
