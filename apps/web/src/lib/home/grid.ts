// The home grid's placement rules, as pure functions over cell rectangles.
// Gravity is vertical only: every widget rises until something stops it, so
// a layout never keeps a hole — which is also why a move is resolved by
// pushing the widgets it lands on downwards and compacting afterwards.

export interface GridRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: GridRect, b: GridRect): boolean =>
  a.id !== b.id &&
  a.x < b.x + b.w &&
  b.x < a.x + a.w &&
  a.y < b.y + b.h &&
  b.y < a.y + a.h;

const byReadingOrder = (a: GridRect, b: GridRect) => a.y - b.y || a.x - b.x;

/** Lifts every rectangle as high as it goes, top-left first; keeps input order. */
export function compact<T extends GridRect>(items: readonly T[]): T[] {
  const placed: T[] = [];

  for (const item of [...items].sort(byReadingOrder)) {
    const next = { ...item };
    while (
      next.y > 0 &&
      !placed.some((p) => overlaps({ ...next, y: next.y - 1 }, p))
    )
      next.y--;
    for (
      let blocker = placed.find((p) => overlaps(next, p));
      blocker;
      blocker = placed.find((p) => overlaps(next, p))
    )
      next.y = blocker.y + blocker.h;
    placed.push(next);
  }

  const byId = new Map(placed.map((p) => [p.id, p]));
  return items.map((item) => byId.get(item.id)!);
}

// Pushes whatever `moved` now covers out of its way. Only a direct hit from a
// widget the user dragged downwards may hop *above* it: without that, dragging
// a widget onto the one below it could never swap them — the one below would
// be pushed down, then gravity would put both back where they started.
function pushAside<T extends GridRect>(
  items: T[],
  moved: T,
  movedDown: boolean,
): void {
  // Bottom-most first: a stack pushed down keeps its order, each widget
  // landing on the one below it rather than shoving it past itself.
  const hits = items
    .filter((other) => overlaps(moved, other))
    .sort((a, b) => byReadingOrder(b, a));

  for (const other of hits) {
    if (movedDown) {
      const above = { ...other, y: moved.y - other.h };

      if (
        above.y >= 0 &&
        !items.some((o) => o.id !== other.id && overlaps(above, o))
      ) {
        other.y = above.y;
        continue;
      }
    }

    other.y = moved.y + moved.h;
    pushAside(items, other, false);
  }
}

/** `id` dropped at column `x`, row `y` — clamped inside `cols` — then compacted. */
export function moveItem<T extends GridRect>(
  layout: readonly T[],
  id: string,
  x: number,
  y: number,
  cols: number,
): T[] {
  const items = layout.map((item) => ({ ...item }));
  const moved = items.find((item) => item.id === id);
  if (!moved) return compact(items);
  const movedDown = y > moved.y;
  moved.x = Math.min(Math.max(0, x), cols - moved.w);
  moved.y = Math.max(0, y);
  pushAside(items, moved, movedDown);
  return compact(items);
}

/** `id` resized to `w` × `h` from its top-left corner, then compacted. */
export function resizeItem<T extends GridRect>(
  layout: readonly T[],
  id: string,
  w: number,
  h: number,
  cols: number,
): T[] {
  const items = layout.map((item) => ({ ...item }));
  const resized = items.find((item) => item.id === id);
  if (!resized) return compact(items);
  resized.w = Math.min(Math.max(1, w), cols - resized.x);
  resized.h = Math.max(1, h);
  pushAside(items, resized, false);
  return compact(items);
}

/** First row below every rectangle — where a new widget is dropped. */
export const bottomRow = (items: readonly GridRect[]): number =>
  items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);

/** The order a narrow screen stacks the widgets in: by top row, then left to right. */
export const stackOrder = <T extends GridRect>(items: readonly T[]): T[] =>
  [...items].sort(byReadingOrder);
