import { m } from "#lib/paraglide/messages.js";
import type { IconName } from "#lib/types/icon-name.js";
import { Domain } from "@loomkeep/shared";

export const DOMAINS: Record<
  Domain,
  {
    label: string;
    href: string;
    icon: IconName;
    comingSoon?: boolean;
    /** What a search box looks for: "Chercher {searchHint}…". */
    searchHint: string;
    /**
     * The domain's hue, the stats charts' own (`--stat-*` in app.css);
     * "Bientôt" domains fall back to the neutral `--dim`.
     */
    accent: string;
  }
> = {
  [Domain.MEDIA]: {
    href: "/app/media",
    get label() {
      return m.common_Media();
    },
    icon: "tv",
    searchHint: m.search_domain_media(),
    accent: "var(--stat-media)",
  },
  [Domain.GAMES]: {
    href: "/app/games",
    get label() {
      return m.common_Games();
    },
    icon: "gamepad",
    searchHint: m.search_domain_games(),
    accent: "var(--stat-games)",
  },
  [Domain.BOOKS]: {
    href: "/app/books",
    get label() {
      return m.common_Books();
    },
    icon: "book",
    searchHint: m.search_domain_books(),
    accent: "var(--stat-books)",
  },
  [Domain.MUSIC]: {
    href: "/app/music",
    get label() {
      return m.common_Music();
    },
    icon: "music",
    searchHint: m.search_domain_music(),
    accent: "var(--stat-music)",
  },
  [Domain.PODCASTS]: {
    href: "/app/podcasts",
    get label() {
      return m.common_Podcasts();
    },
    icon: "podcast",
    comingSoon: true,
    searchHint: m.search_domain_podcasts(),
    accent: "var(--dim)",
  },
  [Domain.BOARDGAMES]: {
    href: "/app/boardgames",
    get label() {
      return m.common_Boardgames();
    },
    icon: "boardgame",
    comingSoon: true,
    searchHint: m.search_domain_boardgames(),
    accent: "var(--dim)",
  },
};

export const DOMAIN_IDS = Object.keys(DOMAINS) as Domain[];
