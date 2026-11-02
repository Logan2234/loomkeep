import { tapFeedback } from "#lib/native/haptics.js";

const MOVE_TOLERANCE = 10;
/** Kept in step with the `[data-pressing]` shrink in app.css. */
const DURATION = 450;

type LongPressParams = {
  onLongPress: () => void;
  enabled?: boolean;
};

/**
 * Holding a finger on the node fires `onLongPress`: the phone's stand-in for
 * what hovering reveals on desktop. While held, `data-pressing` lets the node
 * sink a little to say something is coming; on firing, a light vibration, and
 * the click the finger's release would make (on a link, say) is swallowed.
 * Android's own context menu is replaced, for touch only.
 */
export function longpress(node: HTMLElement, params: LongPressParams) {
  let { onLongPress, enabled = true } = params;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let touching = false;

  function mark() {
    if (enabled) node.dataset.longpress = "";
    else delete node.dataset.longpress;
  }

  function release() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    delete node.dataset.pressing;
  }

  function start(e: PointerEvent) {
    touching = e.pointerType === "touch";
    if (!enabled || !touching) return;
    startX = e.clientX;
    startY = e.clientY;
    release();
    node.dataset.pressing = "";
    timer = setTimeout(() => {
      release();
      swallowNextClick();
      tapFeedback();
      onLongPress();
    }, DURATION);
  }

  function move(e: PointerEvent) {
    if (timer === null) return;

    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
      release();
    }
  }

  // Anywhere on the page: what just opened may already be under the finger
  // (a sheet's backdrop, which that click would close). Android may send no
  // click at all, so the next press calls it off.
  function swallowNextClick() {
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const disarm = () => {
      removeEventListener("click", swallow, true);
      removeEventListener("pointerdown", disarm, true);
    };

    addEventListener("click", swallow, { capture: true, once: true });
    addEventListener("pointerdown", disarm, { capture: true, once: true });
  }

  function contextMenu(e: MouseEvent) {
    if (enabled && touching) e.preventDefault();
  }

  mark();
  node.addEventListener("pointerdown", start);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", release);
  node.addEventListener("pointercancel", release);
  node.addEventListener("contextmenu", contextMenu);

  return {
    update(next: LongPressParams) {
      onLongPress = next.onLongPress;
      enabled = next.enabled ?? true;
      mark();
    },
    destroy() {
      release();
      node.removeEventListener("pointerdown", start);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", release);
      node.removeEventListener("contextmenu", contextMenu);
    },
  };
}
