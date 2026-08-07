/**
 * Earliest/latest timestamp in a list, without `Math.min(...arr)`/
 * `Math.max(...arr)` — spreading a large enough array as call arguments
 * blows the JS call stack (V8's limit is in the tens of thousands), which a
 * long-lived account's full watch history can realistically reach. Plain
 * reduces stay O(n) regardless of size.
 */
export function earliest(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return new Date(
    dates.reduce((min, d) => Math.min(min, d.getTime()), Infinity),
  );
}

export function latest(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return new Date(
    dates.reduce((max, d) => Math.max(max, d.getTime()), -Infinity),
  );
}
