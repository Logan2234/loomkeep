import type { Domain } from "@loomkeep/shared";
import { auth } from "./auth.svelte";

/**
 * Single read-point for the domain-composition preference (see `Domain`).
 * Call it from reactive contexts ($derived / markup) so it re-runs when the
 * user changes. Falls back to "enabled" when the user or field is missing, so
 * nothing is hidden before the profile has loaded.
 *
 * The nav and the global search consume it today; notification filtering will
 * reuse this same helper next. The API enforces the same gate server-side (see
 * `DomainGateService`).
 */
export function isDomainEnabled(domain: Domain): boolean {
  const enabled = auth.user?.enabledDomains;
  return enabled ? enabled.includes(domain) : true;
}
