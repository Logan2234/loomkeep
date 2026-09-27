import { describe, expect, it } from "vitest";
import { isPastedLink, readSharedLink } from "./share-link";

const read = (query: string) => readSharedLink(new URLSearchParams(query));

describe("readSharedLink", () => {
  it("takes the url param, with the shared title as the fallback search", () => {
    expect(
      read("url=https://www.imdb.com/title/tt0133093/&title=The Matrix"),
    ).toEqual({
      link: "https://www.imdb.com/title/tt0133093/",
      searchTerm: "The Matrix",
    });
  });

  it("finds the link inside the text when the app puts it there", () => {
    expect(
      read(
        `text=${encodeURIComponent("Regarde ça https://store.steampowered.com/app/367520/Hollow_Knight/")}`,
      ),
    ).toEqual({
      link: "https://store.steampowered.com/app/367520/Hollow_Knight/",
      searchTerm: "Regarde ça",
    });
  });

  it("falls back to searching the text when nothing was a link", () => {
    expect(read("text=Frieren")).toEqual({
      link: null,
      searchTerm: "Frieren",
    });
  });
});

describe("isPastedLink", () => {
  it("tells a lone link from words", () => {
    expect(isPastedLink(" https://anilist.co/anime/154587 ")).toBe(true);
    expect(isPastedLink("frieren https://anilist.co")).toBe(false);
    expect(isPastedLink("dune")).toBe(false);
  });
});
