import { m } from "$lib/paraglide/messages";
import type { IconName } from "$lib/types/icon-name";
import { Domain } from "@loomkeep/shared";

export const DOMAINS: Record<
  Domain,
  {
    label: string;
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
    label: m.common_Media(),
    icon: "tv",
    searchHint: m.search_domain_media(),
    accent: "var(--stat-media)",
  },
  [Domain.GAMES]: {
    label: m.common_Games(),
    icon: "gamepad",
    searchHint: m.search_domain_games(),
    accent: "var(--stat-games)",
  },
  [Domain.BOOKS]: {
    label: m.common_Books(),
    icon: "book",
    searchHint: m.search_domain_books(),
    accent: "var(--stat-books)",
  },
  [Domain.MUSIC]: {
    label: m.common_Music(),
    icon: "music",
    searchHint: m.search_domain_music(),
    accent: "var(--stat-music)",
  },
  [Domain.PODCASTS]: {
    label: m.common_Podcasts(),
    icon: "podcast",
    comingSoon: true,
    searchHint: m.search_domain_podcasts(),
    accent: "var(--dim)",
  },
  [Domain.BOARDGAMES]: {
    label: m.common_Boardgames(),
    icon: "boardgame",
    comingSoon: true,
    searchHint: m.search_domain_boardgames(),
    accent: "var(--dim)",
  },
};
