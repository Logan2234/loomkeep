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
