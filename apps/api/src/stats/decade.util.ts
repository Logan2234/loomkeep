/** e.g. 1990 for a date in 1990-1999. */
export function decadeOf(date: Date): number {
  return Math.floor(date.getUTCFullYear() / 10) * 10;
}
