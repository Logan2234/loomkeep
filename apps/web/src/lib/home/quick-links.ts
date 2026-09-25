import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type { HomeQuickLinkDto } from "@loomkeep/shared";
import { Domain } from "@loomkeep/shared";
import type { HomeGate } from "./widgets";

interface AppDestination {
  id: string;
  href: string;
  label: () => string;
  icon: IconName;
  domain?: Domain;
  social?: boolean;
  gamification?: boolean;
  adminOnly?: boolean;
}

// Every screen a quick link can point to, in the order the settings list them.
// The ids are stored in the user's layout: rename one and the saved links to
// it silently disappear.
const APP_DESTINATIONS: AppDestination[] = [
  {
    id: "profile",
    href: "/app/profile",
    label: () => m.home_sidebar_my_account(),
    icon: "user",
  },
  {
    id: "stats",
    href: "/app/stats",
    label: () => m.common_stats(),
    icon: "stats",
  },
  {
    id: "lists",
    href: "/app/lists",
    label: () => m.lists_title(),
    icon: "list",
  },
  {
    id: "reviews",
    href: "/app/reviews",
    label: () => m.home_sidebar_my_reviews(),
    icon: "star",
  },
  {
    id: "feed",
    href: "/app/feed",
    label: () => m.common_activity_feed(),
    icon: "activity",
    social: true,
  },
  {
    id: "help",
    href: "/app/settings/help",
    label: () => `${m.common_help()} & ${m.common_feedback()}`,
    icon: "message",
  },
  {
    id: "settings",
    href: "/app/settings",
    label: () => m.common_settings(),
    icon: "gear",
  },
  {
    id: "search",
    href: "/app/search",
    label: () => m.common_search(),
    icon: "search",
  },
  {
    id: "media",
    href: "/app/media",
    label: () => m.common_Media(),
    icon: "tv",
    domain: Domain.MEDIA,
  },
  {
    id: "games",
    href: "/app/games",
    label: () => m.common_Games(),
    icon: "gamepad",
    domain: Domain.GAMES,
  },
  {
    id: "books",
    href: "/app/books",
    label: () => m.common_Books(),
    icon: "book",
    domain: Domain.BOOKS,
  },
  {
    id: "music",
    href: "/app/music",
    label: () => m.common_Music(),
    icon: "music",
    domain: Domain.MUSIC,
  },
  {
    id: "calendar",
    href: "/app/calendar",
    label: () => m.common_calendar(),
    icon: "calendar",
    domain: Domain.MEDIA,
  },
  {
    id: "leaderboard",
    href: "/app/leaderboard",
    label: () => m.nav_leaderboard(),
    icon: "crown",
    social: true,
    gamification: true,
  },
  {
    id: "achievements",
    href: "/app/achievements",
    label: () => m.gamification_my_achievements(),
    icon: "trophy",
    gamification: true,
  },
  {
    id: "admin",
    href: "/app/admin",
    label: () => m.common_admin(),
    icon: "shield",
    adminOnly: true,
  },
];

/** The links a new quick-links widget starts with — the old home sidebar's. */
export const DEFAULT_QUICK_LINKS: HomeQuickLinkDto[] = [
  "profile",
  "stats",
  "lists",
  "reviews",
  "feed",
  "help",
  "settings",
].map((id) => ({ kind: "app", id }));

const isReachable = (d: AppDestination, gate: HomeGate): boolean =>
  (!d.domain || gate.isDomainEnabled(d.domain)) &&
  (!d.social || gate.socialEnabled) &&
  (!d.gamification || gate.gamificationEnabled) &&
  (!d.adminOnly || gate.isAdmin);

/** App screens a quick link may point to right now. */
export const appDestinations = (gate: HomeGate): AppDestination[] =>
  APP_DESTINATIONS.filter((d) => isReachable(d, gate));

interface ResolvedQuickLink {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  external: boolean;
}

// A stored address is only ever rendered as an href when it's http(s) — the
// API checks it too, this keeps a hand-edited row from becoming a script link.
export const isWebAddress = (url: string | undefined): url is string =>
  !!url && /^https?:\/\/[^\s]+$/i.test(url);

/**
 * What a stored link points to, gated or not — null when it can't point
 * anywhere (an unknown screen, an address that isn't http(s)).
 */
export function describeQuickLink(
  link: HomeQuickLinkDto,
  index: number,
): (ResolvedQuickLink & { reachable: (gate: HomeGate) => boolean }) | null {
  if (link.kind === "url") {
    if (!isWebAddress(link.url) || !link.label) return null;
    return {
      key: `url-${index}`,
      href: link.url,
      label: link.label,
      icon: "globe",
      external: true,
      reachable: () => true,
    };
  }

  const destination = APP_DESTINATIONS.find((d) => d.id === link.id);
  if (!destination) return null;
  return {
    key: destination.id,
    href: destination.href,
    label: destination.label(),
    icon: destination.icon,
    external: false,
    reachable: (gate) => isReachable(destination, gate),
  };
}

/**
 * Stored links to what the widget renders: unknown or gated-out screens are
 * dropped, like a disabled domain's shortcut in the mobile bar.
 */
export function resolveQuickLinks(
  links: readonly HomeQuickLinkDto[],
  gate: HomeGate,
): ResolvedQuickLink[] {
  return links.flatMap((link, index) => {
    const described = describeQuickLink(link, index);
    if (!described || !described.reachable(gate)) return [];
    const { key, href, label, icon, external } = described;
    return [{ key, href, label, icon, external }];
  });
}
