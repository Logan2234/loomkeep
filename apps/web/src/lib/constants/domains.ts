import type { IconName } from "$lib/types/icon-name";
import { Domain } from "@loomkeep/shared";

export const DOMAINS: Record<
  Domain,
  { label: string; icon: IconName; comingSoon?: boolean }
> = {
  [Domain.MEDIA]: { label: "Vidéo", icon: "tv" },
  [Domain.GAMES]: { label: "Jeux", icon: "gamepad" },
  [Domain.BOOKS]: { label: "Livres", icon: "book" },
  [Domain.MUSIC]: { label: "Musique", icon: "music" },
  [Domain.PODCASTS]: { label: "Podcasts", icon: "podcast", comingSoon: true },
  [Domain.BOARDGAMES]: {
    label: "Jeux de société",
    icon: "boardgame",
    comingSoon: true,
  },
};
