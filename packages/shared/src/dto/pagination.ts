/**
 * Default page size for every user-facing list endpoint, unless the caller
 * asks for another `limit`. One value on purpose: each domain used to carry
 * its own copy, which drifted (40 in the library services, 50 in admin, 20
 * for comments) with nothing behind the difference.
 */
export const DEFAULT_PAGE_SIZE = 20;

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
export const MAX_PAGE_LIMIT = 200;

/** A page of results, plus enough metadata to drive infinite scroll. */
export interface PagedResult<T> {
  items: T[];
  /** Whether a further page exists beyond this one. */
  hasMore: boolean;
  /**
   * Total items matching the current filters, across all pages — omitted
   * where it isn't cheaply available (e.g. an external catalog search).
   */
  total?: number;
}
