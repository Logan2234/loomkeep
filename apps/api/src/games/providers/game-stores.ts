import {
  GAME_STORES,
  type GameStore,
  type GameStoreLinkDto,
} from "@loomkeep/shared/contracts";

// Matched on the link rather than IGDB's website type, which IGDB is
// renumbering (`category` → `type`). Some hosts also serve the brand's own
// site, hence the path checks: IGDB still has Epic's pre-2022 store links
// under www.epicgames.com/store.
const STORE_MATCHERS: Record<GameStore, (url: URL) => boolean> = {
  STEAM: (url) => url.hostname === "store.steampowered.com",
  GOG: (url) => /(^|\.)gog\.com$/.test(url.hostname),
  EPIC: (url) =>
    url.hostname === "store.epicgames.com" ||
    (url.hostname === "www.epicgames.com" &&
      url.pathname.startsWith("/store/")),
  ITCH: (url) => /(^|\.)itch\.io$/.test(url.hostname),
  PLAYSTATION: (url) => url.hostname === "store.playstation.com",
  XBOX: (url) =>
    (url.hostname === "www.xbox.com" && url.pathname.includes("/store/")) ||
    (url.hostname === "www.microsoft.com" && url.pathname.includes("/p/")),
  NINTENDO: (url) =>
    url.hostname === "www.nintendo.com" &&
    /\/(store\/products|games\/detail)\//.test(url.pathname),
  APP_STORE: (url) => /^(apps|itunes)\.apple\.com$/.test(url.hostname),
  GOOGLE_PLAY: (url) => url.hostname === "play.google.com",
};

/** The stores among a game's links, one link each, in display order. */
export function gameStoreLinks(urls: string[]): GameStoreLinkDto[] {
  const found = new Map<GameStore, string>();

  for (const raw of urls) {
    let url: URL;

    try {
      url = new URL(raw);
    } catch {
      continue;
    }

    const store = GAME_STORES.find((s) => STORE_MATCHERS[s](url));
    if (store && !found.has(store)) found.set(store, raw);
  }

  return GAME_STORES.flatMap((store) =>
    found.has(store) ? [{ store, url: found.get(store)! }] : [],
  );
}
