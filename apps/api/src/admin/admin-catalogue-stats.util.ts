import type { AdminPopularWorkDto } from "@tracklore/shared";

/** How many works the mixed "most popular" ranking carries. */
export const POPULAR_WORKS_LIMIT = 20;

/** Rounded percentage of `part` within `total`; 0 when there is nothing to divide. */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** One domain's cache reduced to what the mutualisation/orphan figures need. */
export interface DomainReferenceCounts {
  /** Cached items for that domain. */
  totalItems: number;
  /** Entry count of every *referenced* item (items with 0 entries are absent). */
  entriesPerItem: number[];
}

/**
 * Cross-domain cache mutualisation: how much of the cache is shared, and how
 * much nobody references any more. Both are single instance-wide figures — a
 * per-domain split would say more about domain adoption than about the cache.
 */
export function summariseReferences(domains: DomainReferenceCounts[]): {
  orphanCount: number;
  sharedPercent: number;
} {
  let totalItems = 0;
  let referenced = 0;
  let shared = 0;

  for (const d of domains) {
    totalItems += d.totalItems;
    referenced += d.entriesPerItem.length;
    shared += d.entriesPerItem.filter((c) => c >= 2).length;
  }

  return {
    orphanCount: totalItems - referenced,
    sharedPercent: percent(shared, totalItems),
  };
}

/**
 * Single ranking mixing every domain — the admin cares about what the instance
 * caches hardest, not about per-domain podiums. Ties break on title so the
 * order stays stable between two refreshes.
 */
export function rankPopularWorks(
  candidates: AdminPopularWorkDto[],
  limit = POPULAR_WORKS_LIMIT,
): AdminPopularWorkDto[] {
  return [...candidates]
    .sort((a, b) => b.entries - a.entries || a.title.localeCompare(b.title))
    .slice(0, limit);
}
