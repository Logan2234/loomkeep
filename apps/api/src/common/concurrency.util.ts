/** Stable key for a (source, external id) pair. */
export function refKey(source: string, externalId: string): string {
  return `${source}|${externalId}`;
}

/**
 * Map an array with a bounded number of in-flight async operations.
 *
 * The first rejection wins and is rethrown, but `Promise.all` alone doesn't
 * stop the other workers: they keep draining the queue for a caller that has
 * already given up, and any further rejection surfaces as an unhandled one.
 * `failed` makes them stand down at the next iteration.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (cursor < items.length && !failed) {
      const index = cursor++;

      try {
        results[index] = await fn(items[index]);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
