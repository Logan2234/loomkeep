import { m } from "$lib/paraglide/messages";
import type { IconName } from "$lib/types/icon-name";
import { Domain } from "@loomkeep/shared";

export const DOMAINS: Record<
  Domain,
  { label: string; icon: IconName; comingSoon?: boolean }
> = {
  [Domain.MEDIA]: { label: m.common_Media(), icon: "tv" },
  [Domain.GAMES]: { label: m.common_Games(), icon: "gamepad" },
  [Domain.BOOKS]: { label: m.common_Books(), icon: "book" },
  [Domain.MUSIC]: {
    label: m.common_Music(),
    icon: "music",
    comingSoon: true,
  },
  [Domain.PODCASTS]: {
    label: m.common_Podcasts(),
    icon: "podcast",
    comingSoon: true,
  },
  [Domain.BOARDGAMES]: {
    label: m.common_Boardgames(),
    icon: "boardgame",
    comingSoon: true,
  },
};
