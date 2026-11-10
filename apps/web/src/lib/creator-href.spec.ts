import { describe, expect, it } from "vitest";
import { creatorHref } from "./creator-href";

describe("creatorHref", () => {
  it("links a TMDB person to their page", () => {
    expect(creatorHref({ source: "tmdb", id: "137427" })).toBe(
      "/app/people/tmdb/137427",
    );
  });

  it("gives no link for a source without person pages yet", () => {
    expect(creatorHref({ source: "anilist", id: "95185" })).toBeNull();
    expect(creatorHref({ source: "igdb", id: "70" })).toBeNull();
    expect(creatorHref({ source: "openlibrary", id: "OL79034A" })).toBeNull();
  });
});
