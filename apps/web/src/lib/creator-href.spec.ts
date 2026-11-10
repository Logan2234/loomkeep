import { describe, expect, it } from "vitest";
import { creatorHref } from "./creator-href";

describe("creatorHref", () => {
  it("links a TMDB person or an Open Library author to their page", () => {
    expect(creatorHref({ source: "tmdb", id: "137427" })).toBe(
      "/app/people/tmdb/137427",
    );
    expect(creatorHref({ source: "openlibrary", id: "OL25712A" })).toBe(
      "/app/people/openlibrary/OL25712A",
    );
  });

  it("gives no link for a source without person pages yet", () => {
    expect(creatorHref({ source: "anilist", id: "95185" })).toBeNull();
    expect(creatorHref({ source: "igdb", id: "70" })).toBeNull();
  });
});
