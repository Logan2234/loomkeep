import {
  Domain,
  maintenanceFlag,
  PREMIUM_DOMAINS,
  type ReviewTargetType,
} from "@loomkeep/shared";
import { auth } from "./auth.svelte";
import { DOMAINS } from "./constants/domains";
import { liveFlags } from "./feature-flags-live.svelte";

/**
 * Single read-point for the domain-composition preference (see `Domain`).
 * Call it from reactive contexts ($derived / markup) so it re-runs when the
 * user changes. Falls back to "enabled" when the user or field is missing, so
 * nothing is hidden before the profile has loaded.
 *
 * Also excludes any domain an admin put under deployment-wide maintenance —
 * a live `MAINTENANCE_<DOMAIN>` Unleash flag (see `liveFlags`), treated
 * exactly like the user having turned the domain off themselves. Updates
 * without a reload; this only hides UI — `DomainGateService` is what actually
 * enforces the gate server-side.
 *
 * And a premium domain while the plan is enforced and the account is free:
 * `enabledDomains` is the user's raw choice, which can still name one from
 * before it became premium-gated (`DomainGateService` anticipates exactly
 * that). Without this, the nav offered the domain and the home page mounted
 * its section, for endpoints answering 403.
 *
 * The settings tiles deliberately read `auth.user.enabledDomains` directly
 * instead: that screen shows the raw choice, with its own lock badge.
 */
export function isDomainEnabled(domain: Domain): boolean {
  return domainOffReason(domain) === null;
}

/**
 * Why `isDomainEnabled(domain)` is false, or `null` when it isn't — so a
 * warning can say whether the user can turn the domain back on themselves
 * or has to wait out a maintenance.
 */
export function domainOffReason(
  domain: Domain,
): "maintenance" | "premium" | "off" | null {
  if (liveFlags.isEnabled(maintenanceFlag(domain))) return "maintenance";
  if (auth.isPremiumLocked && PREMIUM_DOMAINS.includes(domain))
    return "premium";
  const enabled = auth.user?.enabledDomains;
  return !enabled || enabled.includes(domain) ? null : "off";
}

/**
 * Every domain, in the user's preferred display order (settings tiles, the
 * desktop rail's Library section). Total and partial-safe: a domain missing
 * from `preference` — unset, or shipped after the preference was saved —
 * keeps its canonical position at the end rather than being dropped.
 */
export function orderedDomains(preference: Domain[] | undefined): Domain[] {
  const canonical = Object.keys(DOMAINS) as Domain[];
  if (!preference?.length) return canonical;
  const rank = new Map(preference.map((d, i) => [d, i]));
  return [...canonical].sort(
    (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity),
  );
}

/**
 * Toggles `id` in `current`, refusing to drop the last remaining domain —
 * used by both the settings "Domaines" section and the onboarding wizard's
 * domain step so the "at least one" rule can't drift between the two.
 * Rebuilds in canonical order so the stored list stays tidy.
 */
export function toggleDomainSelection(current: Domain[], id: Domain): Domain[] {
  const has = current.includes(id);
  if (has && current.length === 1) return current;
  return Object.keys(DOMAINS).filter((d) =>
    d === id ? !has : current.includes(d as Domain),
  ) as Domain[];
}

const DOMAIN_OF_TARGET: Record<ReviewTargetType, Domain> = {
  MEDIA: Domain.MEDIA,
  SEASON: Domain.MEDIA,
  EPISODE: Domain.MEDIA,
  GAME: Domain.GAMES,
  BOOK: Domain.BOOKS,
  MUSIC: Domain.MUSIC,
};

/** The domain a review or list item's target belongs to. */
export function targetDomain(type: ReviewTargetType): Domain {
  return DOMAIN_OF_TARGET[type];
}

// Each domain's own screens: what its layout redirects away from once the
// domain is off (see `routes/app/{media,calendar,games,books,music}`).
const DOMAIN_PAGES: [RegExp, Domain][] = [
  [/^\/app\/(media|calendar)(?:[/?#]|$)/, Domain.MEDIA],
  [/^\/app\/games(?:[/?#]|$)/, Domain.GAMES],
  [/^\/app\/books(?:[/?#]|$)/, Domain.BOOKS],
  [/^\/app\/music(?:[/?#]|$)/, Domain.MUSIC],
];

/** The domain whose screens `path` belongs to, or `null` for a shared one. */
export function pathDomain(path: string): Domain | null {
  return DOMAIN_PAGES.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}
