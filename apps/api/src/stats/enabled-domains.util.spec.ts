import { filterEnabledDomains } from "./enabled-domains.util";

describe("filterEnabledDomains", () => {
  it("returns every enabled stats domain for ALL", () => {
    expect(
      filterEnabledDomains("ALL", ["MEDIA", "GAMES", "BOOKS", "MUSIC"]),
    ).toEqual(["MEDIA", "GAMES", "BOOKS", "MUSIC"]);
  });

  it("excludes domains the user disabled, for ALL", () => {
    expect(filterEnabledDomains("ALL", ["MEDIA", "BOOKS"])).toEqual([
      "MEDIA",
      "BOOKS",
    ]);
  });

  it("ignores non-stats domains (podcasts/boardgames) even if enabled", () => {
    expect(
      filterEnabledDomains("ALL", ["MEDIA", "PODCASTS", "BOARDGAMES"]),
    ).toEqual(["MEDIA"]);
  });

  it("returns a single requested domain when it is enabled", () => {
    expect(filterEnabledDomains("GAMES", ["MEDIA", "GAMES"])).toEqual([
      "GAMES",
    ]);
  });

  it("returns nothing when the requested domain is disabled", () => {
    expect(filterEnabledDomains("GAMES", ["MEDIA", "BOOKS"])).toEqual([]);
  });
});
