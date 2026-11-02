// Sliding a finger across a page moves to the next tab, on a touch screen only.

import { prefersReducedMotion } from "#lib/motion.js";

const MIN_DISTANCE = 64;
const FLICK_DISTANCE = 30;
const FLICK_SPEED = 0.5;
/** Where Android's own back gesture starts. */
const EDGE = 24;
/** How far a finger goes sideways before the content starts following it. */
const FOLLOW_FROM = 10;
/** Past the last tab, there's nothing to go to: the content only gives a little. */
const EDGE_RESISTANCE = 4;
const SETTLE_MS = 200;
const SETTLE_CURVE = "cubic-bezier(0.2, 0, 0, 1)";

/** What moves under the finger, and whether there's a tab on that side. */
export interface SwipeFollow {
  targets: () => Iterable<Element>;
  canStep: (step: -1 | 1) => boolean;
}

function followFinger(follow: SwipeFollow) {
  let moved: HTMLElement[] = [];

  return {
    move(dx: number) {
      const step = dx < 0 ? 1 : -1;
      const offset = follow.canStep(step) ? dx : dx / EDGE_RESISTANCE;
      moved = [...follow.targets()] as HTMLElement[];

      for (const el of moved) {
        el.style.transform = `translateX(${offset}px)`;
      }
    },
    /** Staying put, it glides back; changing tab, the new one takes over. */
    release(stayed: boolean) {
      for (const el of moved) {
        const from = el.style.transform;
        el.style.transform = "";

        if (stayed && from && !prefersReducedMotion()) {
          el.animate([{ transform: from }, { transform: "none" }], {
            duration: SETTLE_MS,
            easing: SETTLE_CURVE,
          });
        }
      }

      moved = [];
    },
  };
}

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
  follow?: SwipeFollow,
): () => void {
  if (!matchMedia("(pointer: coarse)").matches) return () => {};

  let start: { x: number; y: number; at: number } | null = null;
  const finger = follow && followFinger(follow);
  // Decided once, as a vertical drag is a scroll for its whole length.
  let axis: "x" | "y" | null = null;

  function onStart(event: Event) {
    const { touches, target, timeStamp } = event as TouchEvent;
    start = null;
    axis = null;
    if (touches.length !== 1 || !(target instanceof Element)) return;
    const { clientX: x, clientY: y } = touches[0];
    if (x < EDGE || x > innerWidth - EDGE || ownsGesture(target, root)) return;
    start = { x, y, at: timeStamp };
  }

  function onMove(event: Event) {
    if (!start || !finger || axis === "y" || prefersReducedMotion()) return;
    const touch = (event as TouchEvent).touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (!axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < FOLLOW_FROM) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "y") return;
    }

    finger.move(dx);
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
    finger?.release(!step || !follow?.canStep(step));
    if (step) onStep(step);
  }

  function onCancel() {
    start = null;
    finger?.release(true);
  }

  const passive = { passive: true };
  root.addEventListener("touchstart", onStart, passive);
  root.addEventListener("touchmove", onMove, passive);
  root.addEventListener("touchend", onEnd, passive);
  root.addEventListener("touchcancel", onCancel, passive);

  return () => {
    root.removeEventListener("touchstart", onStart);
    root.removeEventListener("touchmove", onMove);
    root.removeEventListener("touchend", onEnd);
    root.removeEventListener("touchcancel", onCancel);
  };
}

/** What follows a tab strip: its siblings, or those of the block holding it. */
function afterTabs(tabs: Element): Element[] {
  const siblings = (el: Element) => {
    const found: Element[] = [];

    for (let at = el.nextElementSibling; at; at = at.nextElementSibling) {
      found.push(at);
    }

    return found;
  };

  const own = siblings(tabs);
  return own.length > 0 || !tabs.parentElement
    ? own
    : siblings(tabs.parentElement);
}

/** For tabs of their own (Messages): steps only while they're on screen. */
export function tabSwipe(node: HTMLElement, onStep: (step: -1 | 1) => void) {
  let step = onStep;

  // An open conversation covers the tabs and makes them inert.
  const inUse = () => {
    const tabs = node.querySelector("[role='tablist']");
    return tabs && tabs.getClientRects().length > 0 && !tabs.closest("[inert]")
      ? tabs
      : null;
  };

  const stop = listenTabSwipe(
    node,
    (direction) => {
      const tabs = inUse();
      if (!tabs) return;
      step(direction);
      if (prefersReducedMotion()) return;
      requestAnimationFrame(() => {
        for (const el of afterTabs(tabs)) {
          el.animate(
            [
              { opacity: 0, transform: `translateX(${direction * 16}px)` },
              { opacity: 1, transform: "none" },
            ],
            { duration: SETTLE_MS, easing: SETTLE_CURVE },
          );
        }
      });
    },
    {
      targets: () => {
        const tabs = inUse();
        return tabs ? afterTabs(tabs) : [];
      },
      canStep: (direction) => {
        const tabs = [...node.querySelectorAll("[role='tab']")];
        const at = tabs.findIndex(
          (tab) => tab.getAttribute("aria-selected") === "true",
        );
        return at >= 0 && !!tabs[at + direction];
      },
    },
  );
  return {
    update(next: (step: -1 | 1) => void) {
      step = next;
    },
    destroy: stop,
  };
}
