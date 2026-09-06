import type { Domain } from "@loomkeep/shared";
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
 * without a reload; the API's own `DomainGateService` gate is what actually
 * enforces this server-side.
 *
 * The nav and the global search consume it today; notification filtering will
 * reuse this same helper next. The API enforces the same gate server-side (see
 * `DomainGateService`).
 */
export function isDomainEnabled(domain: Domain): boolean {
  if (liveFlags.isEnabled(`MAINTENANCE_${domain}`)) return false;
  const enabled = auth.user?.enabledDomains;
  return enabled ? enabled.includes(domain) : true;
}

/** Whether a domain currently has a usable library/search experience. */
export function isDomainAvailable(domain: Domain): boolean {
  return isDomainEnabled(domain) && !DOMAINS[domain].comingSoon;
}

/**
 * Toggles `id` in `current`, refusing to drop the last available domain —
 * used by both the settings "Domaines" section and the onboarding wizard's
 * domain step so the "at least one usable domain" rule can't drift between
 * the client and API.
 * Rebuilds in canonical order so the stored list stays tidy.
 */
export function toggleDomainSelection(current: Domain[], id: Domain): Domain[] {
  const has = current.includes(id);
  const next = Object.keys(DOMAINS).filter((d) =>
    d === id ? !has : current.includes(d as Domain),
  ) as Domain[];
  return next.some((domain) => !DOMAINS[domain].comingSoon) ? next : current;
}
