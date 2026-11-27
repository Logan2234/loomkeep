/**
 * Deals the sign-in wall's covers out between its rows, so no two rows show
 * the same ones. A row short of covers repeats all of its own as many times as
 * it takes to reach `perRow` tiles: whole rounds only, since the row loops and
 * a partial round would put a cover right next to itself at the seam.
 */
export function dealCovers(
  covers: string[],
  rows: number,
  perRow: number,
): string[][] {
  return Array.from({ length: rows }, (_, row) => {
    const dealt = covers.filter((_, i) => i % rows === row);
    return Array.from(
      { length: Math.ceil(perRow / dealt.length) * dealt.length },
      (_, i) => dealt[i % dealt.length],
    );
  });
}
