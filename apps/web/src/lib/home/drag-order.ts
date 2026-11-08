// The arithmetic behind dragging a row of a vertical list: where it would
// land, and how far the rows it passes slide out of its way meanwhile.

/** The index the dragged row lands at: after every other row whose middle is above its own. */
export function dropIndex(
  rows: { top: number; height: number }[],
  from: number,
  center: number,
): number {
  return rows.filter((r, i) => i !== from && r.top + r.height / 2 < center)
    .length;
}

/** How far row `index` moves while the row at `from` is held over `to`. */
export function dragShift(
  index: number,
  from: number,
  to: number,
  height: number,
): number {
  if (from < to && index > from && index <= to) return -height;
  if (from > to && index >= to && index < from) return height;
  return 0;
}
