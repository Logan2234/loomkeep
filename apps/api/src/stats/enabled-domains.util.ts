import { STATS_DOMAINS, type Domain, type StatsDomain } from "@loomkeep/shared";

/**
 * Resolves which domains a stats request should aggregate: the intersection
 * of the user's `enabledDomains` and the requested filter ("ALL" or one
 * domain). A domain the user disabled never appears, even if explicitly
 * requested — mirrors `DomainGateService.assertEnabled`'s server-side
 * enforcement for the single-domain endpoints.
 */
export function filterEnabledDomains(
  requested: StatsDomain | "ALL",
  userEnabledDomains: Domain[],
): StatsDomain[] {
  const enabled = STATS_DOMAINS.filter((d) => userEnabledDomains.includes(d));
  return requested === "ALL" ? enabled : enabled.filter((d) => d === requested);
}
