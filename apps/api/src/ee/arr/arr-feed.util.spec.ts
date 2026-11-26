import { radarrList, sonarrList, type ArrFeedItem } from "./arr-feed.util";

const ITEMS: ArrFeedItem[] = [
  {
    title: "Heat",
    type: "MOVIE",
    externalIds: [
      { source: "TMDB", externalId: "949" },
      { source: "IMDB", externalId: "tt0113277" },
    ],
  },
  // No IMDb id: Radarr would have to guess from the title.
  {
    title: "Obscure",
    type: "MOVIE",
    externalIds: [{ source: "TMDB", externalId: "1" }],
  },
  {
    title: "Severance",
    type: "SERIES",
    externalIds: [
      { source: "TMDB", externalId: "95396" },
      { source: "TVDB", externalId: "371980" },
    ],
  },
  {
    title: "Frieren",
    type: "ANIME",
    externalIds: [{ source: "TVDB", externalId: "424536" }],
  },
  { title: "Unknown series", type: "SERIES", externalIds: [] },
];

describe("radarrList", () => {
  it("lists the films Radarr can find by IMDb id, in its StevenLu shape", () => {
    expect(radarrList(ITEMS)).toEqual([
      { title: "Heat", imdb_id: "tt0113277" },
    ]);
  });
});

describe("sonarrList", () => {
  it("lists the series and anime Sonarr can find by TVDB id, as numbers", () => {
    expect(sonarrList(ITEMS)).toEqual([
      { title: "Severance", tvdbId: 371980 },
      { title: "Frieren", tvdbId: 424536 },
    ]);
  });
});
