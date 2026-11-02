// Sliding a finger across a page moves to the next tab, on a touch screen only.

const MIN_DISTANCE = 64;
const FLICK_DISTANCE = 30;
const FLICK_SPEED = 0.5;
/** Where Android's own back gesture starts. */
const EDGE = 24;

/** -1 for the previous tab, 1 for the next, 0 for neither. */
export function swipeStep(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  const distance = Math.abs(dx);
  if (distance <= Math.abs(dy)) return 0;
  const flick = distance >= FLICK_DISTANCE && distance / ms >= FLICK_SPEED;
  if (distance < MIN_DISTANCE && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

export function adjacentTab<T>(
  tabs: readonly { value: T; disabled?: boolean }[],
  current: T,
  step: -1 | 1,
): T | null {
  const index = tabs.findIndex((tab) => tab.value === current);

  for (let i = index + step; i >= 0 && i < tabs.length; i += step) {
    if (!tabs[i].disabled) return tabs[i].value;
  }

  return null;
}

/** Whether something under the finger has its own use for a sideways drag. */
function ownsGesture(target: Element, root: Document | HTMLElement): boolean {
  if (
    target.closest(
      "input, textarea, select, [contenteditable='true'], [data-no-tab-swipe]",
    )
  ) {
    return true;
  }

  if (root === document && target.closest("[role='dialog']")) return true;

  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue;
    const { overflowX } = getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }

  return false;
}

export function listenTabSwipe(
  root: Document | HTMLElement,
  onStep: (step: -1 | 1) => void,
): () => void {
  if (!matchMedia("(pointer: coarse)").matches) return () => {};

  let start: { x: number; y: number; at: number } | null = null;

  function onStart(event: Event) {
    const { touches, target, timeStamp } = event as TouchEvent;
    start = null;
    if (touches.length !== 1 || !(target instanceof Element)) return;
    const { clientX: x, clientY: y } = touches[0];
    if (x < EDGE || x > innerWidth - EDGE || ownsGesture(target, root)) return;
    start = { x, y, at: timeStamp };
  }

  function onEnd(event: Event) {
    if (!start) return;
    const { changedTouches, timeStamp } = event as TouchEvent;
    const touch = changedTouches[0];
    const step = swipeStep(
      touch.clientX - start.x,
      touch.clientY - start.y,
      timeStamp - start.at,
    );
    start = null;
    if (step) onStep(step);
  }

  function onCancel() {
    start = null;
  }

  const passive = { passive: true };
  root.addEventListener("touchstart", onStart, passive);
  root.addEventListener("touchend", onEnd, passive);
  root.addEventListener("touchcancel", onCancel, passive);

  return () => {
    root.removeEventListener("touchstart", onStart);
    root.removeEventListener("touchend", onEnd);
    root.removeEventListener("touchcancel", onCancel);
  };
}

/** For tabs of their own (Messages): steps only while they're on screen. */
export function tabSwipe(node: HTMLElement, onStep: (step: -1 | 1) => void) {
  let step = onStep;
  const stop = listenTabSwipe(node, (direction) => {
    const tabs = node.querySelector("[role='tablist']");

    // An open conversation covers the tabs and makes them inert.
    if (tabs && tabs.getClientRects().length > 0 && !tabs.closest("[inert]")) {
      step(direction);
    }
  });
  return {
    update(next: (step: -1 | 1) => void) {
      step = next;
    },
    destroy: stop,
  };
}
