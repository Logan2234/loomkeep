const MOVE_TOLERANCE = 10;

type LongPressParams = {
  onLongPress: () => void;
  duration?: number;
};

/**
 * Generic Svelte action: fires `onLongPress` after holding a touch point on
 * the node for `duration`ms without moving past `MOVE_TOLERANCE` px. Ignores
 * mouse/pen — desktop already reveals per-item actions on hover, so a
 * long-press-to-focus gesture only makes sense on touch.
 */
export function longpress(node: HTMLElement, params: LongPressParams) {
  let { onLongPress, duration = 500 } = params;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function start(e: PointerEvent) {
    if (e.pointerType !== "touch") return;
    startX = e.clientX;
    startY = e.clientY;
    clear();
    timer = setTimeout(() => {
      timer = null;
      onLongPress();
    }, duration);
  }

  function move(e: PointerEvent) {
    if (timer === null) return;

    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
      clear();
    }
  }

  node.addEventListener("pointerdown", start);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", clear);
  node.addEventListener("pointercancel", clear);

  return {
    update(next: LongPressParams) {
      onLongPress = next.onLongPress;
      duration = next.duration ?? 500;
    },
    destroy() {
      clear();
      node.removeEventListener("pointerdown", start);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", clear);
      node.removeEventListener("pointercancel", clear);
    },
  };
}
