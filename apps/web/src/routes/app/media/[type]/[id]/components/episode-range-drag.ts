/** Within this distance of an edge, a drag scrolls the list. */
const EDGE_ZONE = 72;
const MAX_SPEED = 16;

/** Pixels per frame, faster nearer the edge: negative up, positive down. */
export function autoScrollSpeed(
  y: number,
  top: number,
  bottom: number,
): number {
  const speed = (depth: number) =>
    Math.ceil(MAX_SPEED * Math.min(1, depth / EDGE_ZONE));
  if (y < top + EDGE_ZONE) return -speed(top + EDGE_ZONE - y);
  if (y > bottom - EDGE_ZONE) return speed(y - bottom + EDGE_ZONE);
  return 0;
}

function scrollParent(node: Element): Element {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
  }

  return document.scrollingElement ?? document.documentElement;
}

/**
 * Once a long press has fired, follows the pointer over the list's rows and
 * scrolls near its edges, until the pointer lifts, wherever that happens.
 * Returns the way to stop early.
 */
export function followRangeDrag({
  list,
  edges,
  rowAt,
  onOver,
  onEnd,
}: {
  list: Element;
  edges: () => { top: number; bottom: number };
  rowAt: (target: Element) => string | null;
  onOver: (id: string) => void;
  onEnd: () => void;
}): () => void {
  const scroller = scrollParent(list);
  let x = 0;
  let y: number | null = null;
  let frame = 0;

  function over() {
    if (y === null) return;
    const target = document.elementFromPoint(x, y);
    const id = target && rowAt(target);
    if (id) onOver(id);
  }

  function tick() {
    frame = requestAnimationFrame(tick);
    if (y === null) return;
    const { top, bottom } = edges();
    const speed = autoScrollSpeed(y, top, bottom);
    if (speed === 0) return;
    scroller.scrollBy(0, speed);
    over();
  }

  function move(e: PointerEvent) {
    x = e.clientX;
    y = e.clientY;
    over();
  }

  function stop() {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    document.removeEventListener("selectstart", noSelect);
  }

  function end() {
    stop();
    onEnd();
  }

  function noSelect(e: Event) {
    e.preventDefault();
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("selectstart", noSelect);
  frame = requestAnimationFrame(tick);
  return stop;
}
