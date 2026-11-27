import { describe, expect, it } from "vitest";
import { creatorHref, studioHref } from "./creator-href";

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

describe("studioHref", () => {
  it("sends a company and a network to separate pages, their TMDB ids overlapping", () => {
    expect(studioHref("COMPANY", { source: "tmdb", id: "3268" })).toBe(
      "/app/studios/tmdb/3268",
    );
    expect(studioHref("NETWORK", { source: "tmdb", id: "49" })).toBe(
      "/app/networks/tmdb/49",
    );
    expect(studioHref("COMPANY", { source: "anilist", id: "21" })).toBeNull();
  });
});
