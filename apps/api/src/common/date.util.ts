/** An ISO date string to a `Date`, passing `null` through unchanged. */
export function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
