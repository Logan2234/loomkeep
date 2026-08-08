import type { AdminProviderCallsDto } from "@loomkeep/shared";

/** A provider as declared by the services page: its label and documented daily cap. */
export interface ProviderQuotaSpec {
  key: string;
  label: string;
  /** Documented free-tier calls/day, null when the provider publishes none. */
  dailyLimit: number | null;
}

/**
 * Today's call counters joined with the documented quotas, heaviest first.
 *
 * Providers with no call today are dropped: a row of zeros says nothing about
 * the instance's traffic, and the card is a "what did we hit today" list. A
 * counter whose provider key isn't in the specs (a provider added to the
 * tracker but not to the services page) still shows, under its raw key —
 * losing the row would hide real traffic.
 */
export function providerCallRows(
  callsByProvider: Map<string, number>,
  specs: ProviderQuotaSpec[],
): AdminProviderCallsDto[] {
  const byKey = new Map(specs.map((s) => [s.key, s]));

  return [...callsByProvider.entries()]
    .filter(([, calls]) => calls > 0)
    .map(([key, calls]) => {
      const dailyLimit = byKey.get(key)?.dailyLimit ?? null;
      return {
        provider: byKey.get(key)?.label ?? key,
        calls,
        dailyLimit,
        percentUsed:
          dailyLimit === null ? null : Math.round((calls / dailyLimit) * 100),
      };
    })
    .sort((a, b) => b.calls - a.calls || a.provider.localeCompare(b.provider));
}

/**
 * Share (0-100) of `part` within `total`, or null when there is nothing to
 * divide. Null rather than 0: "no notification was ever sent" and "none was
 * ever read" are different signals.
 */
export function shareOrNull(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 100);
}
