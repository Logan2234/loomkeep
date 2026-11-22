import {
  GAME_STORES,
  type GameStore,
  type GameStoreLinkDto,
} from "@loomkeep/shared";

// Matched on the link's host rather than IGDB's website type, which IGDB is
// renumbering (`category` → `type`).
const STORE_HOSTS: Record<GameStore, RegExp> = {
  STEAM: /^store\.steampowered\.com$/,
  GOG: /(^|\.)gog\.com$/,
  EPIC: /^store\.epicgames\.com$/,
  ITCH: /(^|\.)itch\.io$/,
  APP_STORE: /^(apps|itunes)\.apple\.com$/,
  GOOGLE_PLAY: /^play\.google\.com$/,
};

/** The stores among a game's links, one link each, in display order. */
export function gameStoreLinks(urls: string[]): GameStoreLinkDto[] {
  const found = new Map<GameStore, string>();

  for (const url of urls) {
    let host: string;

    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }

    const store = GAME_STORES.find((s) => STORE_HOSTS[s].test(host));
    if (store && !found.has(store)) found.set(store, url);
  }

  return GAME_STORES.flatMap((store) =>
    found.has(store) ? [{ store, url: found.get(store)! }] : [],
  );
}
