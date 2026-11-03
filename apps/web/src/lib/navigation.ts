import { appConfig } from "#lib/config.svelte.js";
import { DOMAINS } from "#lib/constants/domains.js";
import { type FeatureBadgeKey } from "#lib/feature-badges.js";
import { Domain } from "@loomkeep/shared";
import { auth } from "./auth.svelte";
import { orderedDomains } from "./domain-availability";
import { m } from "./paraglide/messages.js";
import type { IconName } from "./types/icon-name";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match(path: string): boolean;
  domain?: Domain;
  /** Shown while at least one of these domains is enabled (vs. `domain`: that one). */
  anyDomain?: Domain[];
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
  newBadgeKey?: FeatureBadgeKey;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAVIGATION: NavSection[] = [
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
        href: DOMAINS.MEDIA.href,
        label: DOMAINS.MEDIA.label,
        icon: DOMAINS.MEDIA.icon,
        domain: Domain.MEDIA,
        match: (p) => p.startsWith(DOMAINS.MEDIA.href),
      },
      {
        href: DOMAINS.GAMES.href,
        label: DOMAINS.GAMES.label,
        icon: DOMAINS.GAMES.icon,
        domain: Domain.GAMES,
        match: (p) => p.startsWith(DOMAINS.GAMES.href),
      },
      {
        href: DOMAINS.BOOKS.href,
        label: DOMAINS.BOOKS.label,
        icon: DOMAINS.BOOKS.icon,
        domain: Domain.BOOKS,
        match: (p) => p.startsWith(DOMAINS.BOOKS.href),
      },
      {
        href: DOMAINS.MUSIC.href,
        label: DOMAINS.MUSIC.label,
        icon: DOMAINS.MUSIC.icon,
        domain: Domain.MUSIC,
        match: (p) => p.startsWith(DOMAINS.MUSIC.href),
      },
      {
        href: DOMAINS.PODCASTS.href,
        label: DOMAINS.PODCASTS.label,
        icon: DOMAINS.PODCASTS.icon,
        domain: Domain.PODCASTS,
        comingSoon: true,
        match: () => false,
      },
      {
        href: DOMAINS.BOARDGAMES.href,
        label: DOMAINS.BOARDGAMES.label,
        icon: DOMAINS.BOARDGAMES.icon,
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
        anyDomain: [Domain.MEDIA, Domain.GAMES],
        match: (p) => p.startsWith("/app/calendar"),
      },
      {
        href: "/app/stats",
        label: m.common_stats(),
        icon: "stats",
        match: (p) => p.startsWith("/app/stats"),
      },
      {
        href: "/app/leaderboard",
        label: m.gamification_leaderboard_title(),
        icon: "crown",
        social: true,
        gamification: true,
        match: (p) => p.startsWith("/app/leaderboard"),
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

interface NavGateOptions {
  isDomainEnabled: (domain: Domain) => boolean;
  socialEnabled: boolean;
  gamificationEnabled: boolean;
}

const isNavItemVisible = (item: NavItem, opts: NavGateOptions): boolean =>
  (!item.domain || opts.isDomainEnabled(item.domain)) &&
  (!item.anyDomain || item.anyDomain.some(opts.isDomainEnabled)) &&
  (!item.social || opts.socialEnabled) &&
  (!item.gamification || opts.gamificationEnabled);

/**
 * Applies the user's domain display order (see settings' Domaines section)
 * to a section, but only when every one of its items is domain-tagged —
 * the Library section qualifies, a mixed one like Tracking (Calendar next to
 * Stats/Feed) is left in its authored order instead of being scrambled.
 */
function sortByDomainOrder(items: NavItem[]): NavItem[] {
  if (items.length === 0 || !items.every((item) => item.domain)) return items;
  const rank = new Map(
    orderedDomains(auth.user?.domainOrder).map((d, i) => [d, i]),
  );
  return [...items].sort(
    (a, b) =>
      (rank.get(a.domain!) ?? Infinity) - (rank.get(b.domain!) ?? Infinity),
  );
}

/**
 * `NAVIGATION` sections filtered to what's visible on this deployment/user.
 * `includeComingSoon` defaults to true (the desktop rail renders a planned
 * domain dimmed with a "Bientôt" badge); the board/dock/mobile-bar skins have
 * no room for a non-clickable tile and pass `false` to drop it entirely.
 */
export function visibleNavSections(
  opts: NavGateOptions,
  { includeComingSoon = true }: { includeComingSoon?: boolean } = {},
): NavSection[] {
  return NAVIGATION.map((section) => ({
    label: section.label,
    items: sortByDomainOrder(
      section.items.filter(
        (item) =>
          isNavItemVisible(item, opts) &&
          (includeComingSoon || !item.comingSoon),
      ),
    ),
  })).filter((section) => section.items.length > 0);
}

/** Flat counterpart of {@link visibleNavSections}, for skins with no section grouping. */
export function visibleNavItems(
  opts: NavGateOptions,
  filterOpts?: { includeComingSoon?: boolean },
): NavItem[] {
  return visibleNavSections(opts, filterOpts).flatMap((s) => s.items);
}

// Mobile navigation
// The mobile UI is driven by a flat registry of destinations (below) rather
// than the desktop `NAVIGATION` sections: the bottom tab bar shows a short,
// user-orderable subset around the Library tab, which opens the domains as a
// fan, and the menu sheet pulled up from the bar shows the rest, grouped.
// Messages and Alerts live in their own edge tab. Desktop keeps its own rail
// structure above — the two don't share layout, only the underlying routes.

// Stable id for a mobile destination; also the value stored in the user's
//  bottom-bar shortcut list. `library` is the domain fan (no route of its own).
export type MobileNavId =
  | "home"
  | "search"
  | "library"
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
  /** Hidden only when every one of these domains is disabled. */
  anyDomain?: Domain[];
  /** Planned domain with no screen yet: kept out of the Library fan. */
  comingSoon?: boolean;
  /** Only surfaced to admins (the /admin entry). */
  adminOnly?: boolean;
  /** Hidden until the social features (P4) are enabled on the deployment. */
  social?: boolean;
  /** Hidden until GAMIFICATION_ENABLED is enabled on the deployment. */
  gamification?: boolean;
  /** One line under its label in the menu sheet. */
  hint?: () => string;
  /** Key into feature-badges.ts — shows a "Nouveau" dot while its window is open. */
  newBadgeKey?: FeatureBadgeKey;
}

// Labels are getters: read when drawn, in the locale of the moment, not the
// one the module happened to load in.
const MOBILE_DESTINATIONS: Record<MobileNavId, MobileDestination> = {
  home: {
    id: "home",
    href: "/app",
    get label() {
      return m.common_home();
    },
    icon: "home",
    match: (p) => p === "/app",
  },
  search: {
    id: "search",
    href: "/app/search",
    get label() {
      return m.common_search();
    },
    icon: "search",
    match: (p) => p.startsWith("/app/search"),
  },
  // Drawn by LibraryTab, which opens the domains rather than a page.
  library: {
    id: "library",
    href: "#library",
    get label() {
      return m.common_library();
    },
    icon: "library",
    newBadgeKey: "phone-navigation",
    match: () => false,
  },
  media: {
    id: "media",
    href: DOMAINS.MEDIA.href,
    get label() {
      return DOMAINS.MEDIA.label;
    },
    icon: DOMAINS.MEDIA.icon,
    domain: Domain.MEDIA,
    match: (p) => p.startsWith(DOMAINS.MEDIA.href),
  },
  games: {
    id: "games",
    href: DOMAINS.GAMES.href,
    get label() {
      return DOMAINS.GAMES.label;
    },
    icon: DOMAINS.GAMES.icon,
    domain: Domain.GAMES,
    match: (p) => p.startsWith(DOMAINS.GAMES.href),
  },
  books: {
    id: "books",
    href: DOMAINS.BOOKS.href,
    get label() {
      return DOMAINS.BOOKS.label;
    },
    icon: DOMAINS.BOOKS.icon,
    domain: Domain.BOOKS,
    match: (p) => p.startsWith(DOMAINS.BOOKS.href),
  },
  music: {
    id: "music",
    href: DOMAINS.MUSIC.href,
    get label() {
      return DOMAINS.MUSIC.label;
    },
    icon: DOMAINS.MUSIC.icon,
    domain: Domain.MUSIC,
    match: (p) => p.startsWith(DOMAINS.MUSIC.href),
  },
  podcasts: {
    id: "podcasts",
    href: DOMAINS.PODCASTS.href,
    get label() {
      return DOMAINS.PODCASTS.label;
    },
    icon: DOMAINS.PODCASTS.icon,
    domain: Domain.PODCASTS,
    comingSoon: true,
    match: () => false,
  },
  boardgames: {
    id: "boardgames",
    href: DOMAINS.BOARDGAMES.href,
    get label() {
      return DOMAINS.BOARDGAMES.label;
    },
    icon: DOMAINS.BOARDGAMES.icon,
    domain: Domain.BOARDGAMES,
    comingSoon: true,
    match: () => false,
  },
  calendar: {
    id: "calendar",
    href: "/app/calendar",
    get label() {
      return m.common_calendar();
    },
    icon: "calendar",
    anyDomain: [Domain.MEDIA, Domain.GAMES],
    hint: m.nav_menu_calendar_hint,
    match: (p) => p.startsWith("/app/calendar"),
  },
  stats: {
    id: "stats",
    href: "/app/stats",
    get label() {
      return m.common_stats();
    },
    icon: "stats",
    hint: m.nav_menu_stats_hint,
    match: (p) => p.startsWith("/app/stats"),
  },
  leaderboard: {
    id: "leaderboard",
    href: "/app/leaderboard",
    get label() {
      return m.gamification_leaderboard_title();
    },
    icon: "crown",
    social: true,
    gamification: true,
    hint: m.nav_menu_leaderboard_hint,
    match: (p) => p.startsWith("/app/leaderboard"),
  },
  feed: {
    id: "feed",
    href: "/app/feed",
    get label() {
      return m.nav_feed();
    },
    icon: "activity",
    social: true,
    hint: m.nav_menu_feed_hint,
    match: (p) => p.startsWith("/app/feed"),
  },
  profile: {
    id: "profile",
    href: "/app/profile",
    get label() {
      return m.nav_profile();
    },
    icon: "user",
    match: (p) => p === "/app/profile",
  },
  settings: {
    id: "settings",
    href: "/app/settings",
    get label() {
      return m.common_settings();
    },
    icon: "gear",
    match: (p) => p.startsWith("/app/settings"),
  },
  admin: {
    id: "admin",
    href: "/app/admin",
    get label() {
      return m.common_admin();
    },
    icon: "shield",
    adminOnly: true,
    match: (p) => p.startsWith("/app/admin"),
  },
};

/** How the menu sheet groups what the bar and the Library fan don't carry. */
const MENU_GROUPS: { label: string; ids: MobileNavId[] }[] = [
  {
    get label() {
      return m.nav_section_essentials();
    },
    ids: ["home", "search"],
  },
  {
    get label() {
      return m.nav_section_tracking();
    },
    ids: ["calendar", "stats", "leaderboard", "feed"],
  },
  {
    get label() {
      return m.common_account();
    },
    ids: ["settings", "admin"],
  },
];

// Bottom bar when the user hasn't customised it, Library aside: it is always
//  there, inserted at the centre (see resolveBottomShortcuts).
export const DEFAULT_BOTTOM_SHORTCUTS: MobileNavId[] = [
  "home",
  "search",
  "calendar",
  "profile",
];

// Destinations the user may pin around Library. The domains are reached
//  through it, Messages and Alerts through the edge tab.
const BOTTOM_SHORTCUT_CHOICES: MobileNavId[] = [
  "home",
  "search",
  "calendar",
  "stats",
  "leaderboard",
  "feed",
  "profile",
  "settings",
  "admin",
];

export function isBottomShortcutChoice(id: string): id is MobileNavId {
  return (BOTTOM_SHORTCUT_CHOICES as string[]).includes(id);
}

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
  (!d.anyDomain || d.anyDomain.some(opts.isDomainEnabled)) &&
  (!d.adminOnly || opts.isAdmin) &&
  (!d.social || !!opts.socialEnabled) &&
  (!d.gamification || !!opts.gamificationEnabled);

/** Where Library sits among `count` other tabs: the centre, or just right of it. */
const libraryIndex = (count: number): number => Math.ceil(count / 2);

// Resolve the stored ids into visible destinations, dropping any gated out by
//  the user's enabled domains / admin role, with Library at the centre.
export const resolveBottomShortcuts = (
  ids: readonly string[],
  opts: MobileGateOptions,
): MobileDestination[] => {
  const others = ids
    .filter(isBottomShortcutChoice)
    .map((id) => MOBILE_DESTINATIONS[id])
    .filter((d) => isVisible(d, opts));
  const centre = libraryIndex(others.length);
  return [
    ...others.slice(0, centre),
    MOBILE_DESTINATIONS.library,
    ...others.slice(centre),
  ];
};

// Destinations the user may pin to the bottom bar, gated to what's currently
//  visible (admin, social). Used by the settings config UI.
export const resolveShortcutChoices = (
  opts: MobileGateOptions,
): MobileDestination[] =>
  BOTTOM_SHORTCUT_CHOICES.map((id) => MOBILE_DESTINATIONS[id]).filter((d) =>
    isVisible(d, opts),
  );

/** The domains the Library tab opens, in the user's display order. */
export function resolveLibraryDomains(
  opts: Pick<MobileGateOptions, "isDomainEnabled">,
): MobileDestination[] {
  const rank = new Map(
    orderedDomains(auth.user?.domainOrder).map((domain, index) => [
      domain,
      index,
    ]),
  );
  return Object.values(MOBILE_DESTINATIONS)
    .filter((d) => d.domain && !d.comingSoon && opts.isDomainEnabled(d.domain))
    .sort(
      (a, b) =>
        (rank.get(a.domain!) ?? Infinity) - (rank.get(b.domain!) ?? Infinity),
    );
}

// These exist nowhere else on a phone, so they show here whenever the bar
//  doesn't carry them. The other destinations always show.
const ONLY_WHEN_OFF_THE_BAR: readonly MobileNavId[] = ["home", "search"];

// Menu sheet groups with their visible destinations.
export function resolveMenuGroups(
  opts: MobileGateOptions,
  barIds: readonly string[] = [],
): { label: string; items: MobileDestination[] }[] {
  return MENU_GROUPS.map((g) => ({
    label: g.label,
    items: g.ids
      .map((id) => MOBILE_DESTINATIONS[id])
      .filter((d) => isVisible(d, opts))
      .filter(
        (d) => !ONLY_WHEN_OFF_THE_BAR.includes(d.id) || !barIds.includes(d.id),
      ),
  })).filter((g) => g.items.length > 0);
}

export function profileHref(): string {
  return appConfig.socialEnabled ? "/app/profile" : "/app/settings";
}

/**
 * A tab touched again on its own page goes back to the top, as in any Android
 * app, without reloading. With filters in the URL it stays a normal link,
 * which clears them.
 */
export function scrollUpOnReselect(
  event: MouseEvent,
  href: string,
  current: Pick<URL, "pathname" | "search">,
): void {
  if (current.pathname !== href || current.search) return;
  event.preventDefault();
  scrollTo({ top: 0 });
}
