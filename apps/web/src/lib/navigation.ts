import { Domain } from "@loomkeep/shared";
import { m } from "./paraglide/messages.js";
import type { IconName } from "./types/icon-name";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match(path: string): boolean;
  domain?: Domain;
  /**
   * Domaine planifié sans écran : rendu non cliquable avec un badge « Bientôt ».
   * `href`/`match` restent présents (clé de liste) mais ne sont pas suivis.
   */
  comingSoon?: boolean;
  /** Masqué tant que la dimension sociale (P4) n'est pas activée sur le déploiement. */
  social?: boolean;
  /** Masqué tant que GAMIFICATION_ENABLED n'est pas activé sur le déploiement. */
  gamification?: boolean;
  /** Key into feature-badges.ts — shows a "Nouveau" dot while its window is open. */
  newBadgeKey?: string;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    items: [
      {
        href: "/app",
        label: m.common_home(),
        icon: "home",
        match: (p) => p === "/app",
      },
      {
        href: "/app/search",
        label: m.common_search(),
        icon: "search",
        match: (p) => p.startsWith("/app/search"),
      },
    ],
  },
  {
    label: m.nav_section_library(),
    items: [
      {
        href: "/app/media",
        label: m.common_Media(),
        icon: "tv",
        domain: Domain.MEDIA,
        match: (p) => p.startsWith("/app/media"),
      },
      {
        href: "/app/games",
        label: m.common_Games(),
        icon: "gamepad",
        domain: Domain.GAMES,
        match: (p) => p.startsWith("/app/games"),
      },
      {
        href: "/app/books",
        label: m.common_Books(),
        icon: "book",
        domain: Domain.BOOKS,
        match: (p) => p.startsWith("/app/books"),
      },
      {
        href: "/app/music",
        label: m.common_Music(),
        icon: "music",
        domain: Domain.MUSIC,
        match: (p) => p.startsWith("/app/music"),
      },
      {
        href: "/app/podcasts",
        label: m.common_Podcasts(),
        icon: "podcast",
        domain: Domain.PODCASTS,
        comingSoon: true,
        match: () => false,
      },
      {
        href: "/app/boardgames",
        label: m.common_Boardgames(),
        icon: "boardgame",
        domain: Domain.BOARDGAMES,
        comingSoon: true,
        match: () => false,
      },
    ],
  },
  {
    label: m.nav_section_tracking(),
    items: [
      {
        href: "/app/calendar",
        label: m.common_calendar(),
        icon: "calendar",
        domain: Domain.MEDIA,
        match: (p) => p.startsWith("/app/calendar"),
        newBadgeKey: "calendar-subscribe",
      },
      {
        href: "/app/stats",
        label: m.common_stats(),
        icon: "stats",
        match: (p) => p.startsWith("/app/stats"),
      },
      {
        href: "/app/leaderboard",
        label: m.nav_leaderboard(),
        icon: "crown",
        social: true,
        gamification: true,
        match: (p) => p.startsWith("/app/leaderboard"),
        newBadgeKey: "leaderboard",
      },
      {
        href: "/app/feed",
        label: m.nav_feed(),
        icon: "activity",
        social: true,
        match: (p) => p.startsWith("/app/feed"),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mobile navigation
//
// The mobile UI is driven by a flat registry of destinations (below) rather
// than the desktop `NAVIGATION` sections: the bottom tab bar shows a short,
// user-orderable subset (Phase B) and the "Menu" launcher sheet shows all of
// them, grouped. Desktop keeps its own rail structure above — the two don't
// share layout, only the underlying routes.
// ---------------------------------------------------------------------------

// Stable id for a mobile destination; also the value stored in the user's
//  bottom-bar shortcut list. `menu` is the launcher itself (no route).
export type MobileNavId =
  | "home"
  | "search"
  | "menu"
  | "media"
  | "games"
  | "books"
  | "music"
  | "podcasts"
  | "boardgames"
  | "calendar"
  | "stats"
  | "leaderboard"
  | "feed"
  | "profile"
  | "settings"
  | "admin";

export interface MobileDestination {
  id: MobileNavId;
  href: string;
  label: string;
  icon: IconName;
  match(path: string): boolean;
  /** Hidden when the domain is disabled in the user's composition. */
  domain?: Domain;
  /** Planned domain with no screen yet: shown dimmed with a "Bientôt" badge. */
  comingSoon?: boolean;
  /** Only surfaced to admins (the /admin entry). */
  adminOnly?: boolean;
  /** Hidden until the social features (P4) are enabled on the deployment. */
  social?: boolean;
  /** Hidden until GAMIFICATION_ENABLED is enabled on the deployment. */
  gamification?: boolean;
  /** Key into feature-badges.ts — shows a "Nouveau" dot while its window is open. */
  newBadgeKey?: string;
}

const MOBILE_DESTINATIONS: Record<MobileNavId, MobileDestination> = {
  home: {
    id: "home",
    href: "/app",
    label: m.common_home(),
    icon: "home",
    match: (p) => p === "/app",
  },
  search: {
    id: "search",
    href: "/app/search",
    label: m.common_search(),
    icon: "search",
    match: (p) => p.startsWith("/app/search"),
  },
  // The launcher itself — opened via an event, never navigated to.
  menu: {
    id: "menu",
    href: "#menu",
    label: m.common_menu(),
    icon: "library",
    match: () => false,
  },
  media: {
    id: "media",
    href: "/app/media",
    label: m.common_Media(),
    icon: "tv",
    domain: Domain.MEDIA,
    match: (p) => p.startsWith("/app/media"),
  },
  games: {
    id: "games",
    href: "/app/games",
    label: m.common_Games(),
    icon: "gamepad",
    domain: Domain.GAMES,
    match: (p) => p.startsWith("/app/games"),
  },
  books: {
    id: "books",
    href: "/app/books",
    label: m.common_Books(),
    icon: "book",
    domain: Domain.BOOKS,
    match: (p) => p.startsWith("/app/books"),
  },
  music: {
    id: "music",
    href: "/app/music",
    label: m.common_Music(),
    icon: "music",
    domain: Domain.MUSIC,
    match: (p) => p.startsWith("/app/music"),
  },
  podcasts: {
    id: "podcasts",
    href: "/app/podcasts",
    label: m.common_Podcasts(),
    icon: "podcast",
    domain: Domain.PODCASTS,
    comingSoon: true,
    match: () => false,
  },
  boardgames: {
    id: "boardgames",
    href: "/app/boardgames",
    label: m.common_Boardgames(),
    icon: "boardgame",
    domain: Domain.BOARDGAMES,
    comingSoon: true,
    match: () => false,
  },
  calendar: {
    id: "calendar",
    href: "/app/calendar",
    label: m.common_calendar(),
    icon: "calendar",
    domain: Domain.MEDIA,
    match: (p) => p.startsWith("/app/calendar"),
    newBadgeKey: "calendar-subscribe",
  },
  stats: {
    id: "stats",
    href: "/app/stats",
    label: m.common_stats(),
    icon: "stats",
    match: (p) => p.startsWith("/app/stats"),
  },
  leaderboard: {
    id: "leaderboard",
    href: "/app/leaderboard",
    label: m.nav_leaderboard(),
    icon: "crown",
    social: true,
    gamification: true,
    match: (p) => p.startsWith("/app/leaderboard"),
    newBadgeKey: "leaderboard",
  },
  feed: {
    id: "feed",
    href: "/app/feed",
    label: m.nav_feed(),
    icon: "activity",
    social: true,
    match: (p) => p.startsWith("/app/feed"),
  },
  profile: {
    id: "profile",
    href: "/app/profile",
    label: m.nav_profile(),
    icon: "user",
    match: (p) => p === "/app/profile",
  },
  settings: {
    id: "settings",
    href: "/app/settings",
    label: m.common_settings(),
    icon: "gear",
    match: (p) => p.startsWith("/app/settings"),
  },
  admin: {
    id: "admin",
    href: "/app/admin",
    label: m.common_admin(),
    icon: "shield",
    adminOnly: true,
    match: (p) => p.startsWith("/app/admin"),
  },
};

/** How the launcher sheet groups every destination. */
const MENU_GROUPS: { label: string; ids: MobileNavId[] }[] = [
  {
    label: m.common_libraries(),
    ids: ["media", "games", "books", "music", "podcasts", "boardgames"],
  },
  {
    label: m.nav_section_tracking(),
    ids: ["calendar", "stats", "leaderboard", "feed"],
  },
  {
    label: m.common_account(),
    ids: ["profile", "admin", "settings"],
  },
];

// Bottom bar when the user hasn't customised it (Phase B). "menu" is required
//  and kept centred so the launcher is a stable thumb target.
export const DEFAULT_BOTTOM_SHORTCUTS: MobileNavId[] = [
  "home",
  "search",
  "menu",
  "calendar",
  "settings",
];

// Destinations the user may pin to the bottom bar (Phase B config UI). Excludes
//  `menu` (always present, not a free choice) and coming-soon placeholders.
const BOTTOM_SHORTCUT_CHOICES: MobileNavId[] = [
  "home",
  "search",
  "media",
  "games",
  "books",
  "music",
  "calendar",
  "stats",
  "settings",
  "admin",
];

interface MobileGateOptions {
  isDomainEnabled: (domain: Domain) => boolean;
  isAdmin: boolean;
  /** Whether social features are enabled on this deployment (default false). */
  socialEnabled?: boolean;
  /** Whether gamification is enabled on this deployment (default false). */
  gamificationEnabled?: boolean;
}

const isVisible = (d: MobileDestination, opts: MobileGateOptions): boolean =>
  (!d.domain || opts.isDomainEnabled(d.domain)) &&
  (!d.adminOnly || opts.isAdmin) &&
  (!d.social || !!opts.socialEnabled) &&
  (!d.gamification || !!opts.gamificationEnabled);

// Resolve the ordered bottom-bar ids into visible destinations, dropping any
//  gated out by the user's enabled domains / admin role. Coming-soon entries
//  can't reach the bar (not offered as choices), so they're excluded too.
export const resolveBottomShortcuts = (
  ids: readonly string[],
  opts: MobileGateOptions,
): MobileDestination[] =>
  ids
    .map((id) => MOBILE_DESTINATIONS[id as MobileNavId])
    .filter((d): d is MobileDestination => !!d && !d.comingSoon)
    .filter((d) => isVisible(d, opts));

// Destinations the user may pin to the bottom bar, gated to what's currently
//  visible (enabled domains / admin). Used by the settings config UI.
export const resolveShortcutChoices = (
  opts: MobileGateOptions,
): MobileDestination[] =>
  BOTTOM_SHORTCUT_CHOICES.map((id) => MOBILE_DESTINATIONS[id]).filter((d) =>
    isVisible(d, opts),
  );

// Launcher sheet groups with their visible destinations (coming-soon kept —
//  they render dimmed with a "Bientôt" badge when their domain is enabled).
export function resolveMenuGroups(
  opts: MobileGateOptions,
): { label: string; items: MobileDestination[] }[] {
  return MENU_GROUPS.map((g) => ({
    label: g.label,
    items: g.ids
      .map((id) => MOBILE_DESTINATIONS[id])
      .filter((d) => isVisible(d, opts)),
  })).filter((g) => g.items.length > 0);
}
