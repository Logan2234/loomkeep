import { parseCatalogLink } from "./link-parser";

describe("parseCatalogLink", () => {
  it.each([
    [
      "https://www.themoviedb.org/movie/603-the-matrix?language=fr",
      { source: "tmdb", type: "MOVIE", id: "603" },
    ],
    [
      "https://www.themoviedb.org/tv/95396-severance",
      { source: "tmdb", type: "SERIES", id: "95396" },
    ],
    [
      "https://m.imdb.com/title/tt0133093/?ref_=ext_shr",
      { source: "imdb", id: "tt0133093" },
    ],
    [
      "https://www.imdb.com/fr/title/tt11280740/",
      { source: "imdb", id: "tt11280740" },
    ],
    [
      "https://anilist.co/anime/154587/Sousou-no-Frieren/",
      { source: "anilist", id: "154587" },
    ],
    [
      "https://myanimelist.net/anime/52991/Sousou_no_Frieren",
      { source: "myanimelist", id: "52991" },
    ],
    [
      "https://www.igdb.com/games/hollow-knight",
      { source: "igdb", slug: "hollow-knight" },
    ],
    [
      "https://store.steampowered.com/app/367520/Hollow_Knight/",
      { source: "steam", appId: "367520" },
    ],
    [
      "https://openlibrary.org/works/OL893414W/Dune",
      { source: "openlibrary-work", id: "OL893414W" },
    ],
    [
      "https://openlibrary.org/books/OL62190138M/Dune",
      { source: "openlibrary-edition", id: "OL62190138M" },
    ],
    [
      "https://openlibrary.org/isbn/978-2-266-32075-3",
      { source: "isbn", isbn: "9782266320753" },
    ],
    [
      "https://musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433",
      {
        source: "musicbrainz-release-group",
        id: "b1392450-e666-3926-a536-22c65f834433",
      },
    ],
    [
      "https://musicbrainz.org/release/0a0d4a6b-8f2f-4b3e-9d2a-9a1c2e7b5c11",
      {
        source: "musicbrainz-release",
        id: "0a0d4a6b-8f2f-4b3e-9d2a-9a1c2e7b5c11",
      },
    ],
  ])("reads %s", (url, expected) => {
    expect(parseCatalogLink(url)).toEqual(expected);
  });

  it.each([
    "not a url",
    "https://letterboxd.com/film/the-matrix/",
    "https://www.themoviedb.org/person/6384-keanu-reeves",
    "javascript:alert(1)//themoviedb.org/movie/603",
    "ftp://www.themoviedb.org/movie/603",
    "https://__proto__/movie/603",
    "https://evil.example/https://www.themoviedb.org/movie/603",
  ])("recognizes nothing in %s", (url) => {
    expect(parseCatalogLink(url)).toBeNull();
  });
});
