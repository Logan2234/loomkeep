import { gameStoreLinks } from "./game-stores";

describe("gameStoreLinks", () => {
  it("keeps one link per store, PC stores first, and drops other sites", () => {
    expect(
      gameStoreLinks([
        "https://play.google.com/store/apps/details?id=x",
        "https://www.gog.com/game/witcher_3",
        "https://store.steampowered.com/app/292030",
        "https://store.steampowered.com/app/499450",
        "https://discord.gg/abc",
        "https://cdprojekt.itch.io/demo",
        "https://apps.apple.com/app/id1",
        "not a url",
      ]),
    ).toEqual([
      { store: "STEAM", url: "https://store.steampowered.com/app/292030" },
      { store: "GOG", url: "https://www.gog.com/game/witcher_3" },
      { store: "ITCH", url: "https://cdprojekt.itch.io/demo" },
      { store: "APP_STORE", url: "https://apps.apple.com/app/id1" },
      {
        store: "GOOGLE_PLAY",
        url: "https://play.google.com/store/apps/details?id=x",
      },
    ]);
  });

  it("finds Epic's old store links and the console stores", () => {
    expect(
      gameStoreLinks([
        "https://www.xbox.com/en-us/games/store/red-dead-redemption-2/9N2ZDN7NWQKV",
        "https://www.epicgames.com/store/product/red-dead-redemption-2",
        "https://store.playstation.com/en-us/concept/209441",
        "https://www.nintendo.com/games/detail/celeste-switch/",
      ]),
    ).toEqual([
      {
        store: "EPIC",
        url: "https://www.epicgames.com/store/product/red-dead-redemption-2",
      },
      {
        store: "PLAYSTATION",
        url: "https://store.playstation.com/en-us/concept/209441",
      },
      {
        store: "XBOX",
        url: "https://www.xbox.com/en-us/games/store/red-dead-redemption-2/9N2ZDN7NWQKV",
      },
      {
        store: "NINTENDO",
        url: "https://www.nintendo.com/games/detail/celeste-switch/",
      },
    ]);
  });

  it("does not take a brand's own pages for its store", () => {
    expect(
      gameStoreLinks([
        "https://www.epicgames.com/fortnite",
        "https://www.xbox.com/en-US/games/halo",
        "https://www.nintendo.com/us/whatsnew/",
      ]),
    ).toEqual([]);
  });

  it("does not take Steam's community pages for its store", () => {
    expect(gameStoreLinks(["https://steamcommunity.com/app/292030"])).toEqual(
      [],
    );
  });
});
