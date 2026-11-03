import { prefersReducedMotion } from "#lib/motion.js";
import { tapFeedback } from "#lib/native/haptics.js";

const MOVE_TOLERANCE = 10;
const DURATION = 450;
const SINK_DELAY = 100;

type LongPressParams = {
  onLongPress: (pressed: HTMLElement) => void;
  enabled?: boolean;
  /** For a whole list on one node: which element a press is on, if any. */
  pick?: (target: Element) => HTMLElement | null;
};

/**
 * Holding a finger on the node fires `onLongPress`: the phone's stand-in for
 * what hovering reveals on desktop. While held, what's pressed sinks a little
 * to say something is coming; on firing, a light vibration, and the click the
 * finger's release would make (on a link, say) is swallowed. Android's own
 * context menu is replaced, for touch only.
 */
export function longpress(node: HTMLElement, params: LongPressParams) {
  let { onLongPress, enabled = true, pick } = params;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sinking: Animation | null = null;
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
    sinking?.cancel();
    sinking = null;
  }

  function sink(pressed: HTMLElement) {
    if (prefersReducedMotion()) return;
    sinking = pressed.animate(
      [{ transform: "none" }, { transform: "scale(0.97)" }],
      {
        delay: SINK_DELAY,
        duration: DURATION - SINK_DELAY,
        easing: "ease-in",
        fill: "forwards",
      },
    );
  }

  function start(e: PointerEvent) {
    touching = e.pointerType === "touch";
    if (!enabled || !touching) return;
    const pressed = pick ? pick(e.target as Element) : node;
    if (!pressed) return;
    startX = e.clientX;
    startY = e.clientY;
    release();
    sink(pressed);
    timer = setTimeout(() => {
      release();
      swallowNextClick();
      tapFeedback();
      onLongPress(pressed);
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

  // A held link or image would start a drag, which ends the press.
  function dragStart(e: DragEvent) {
    if (enabled && touching) e.preventDefault();
  }

  mark();
  node.addEventListener("pointerdown", start);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", release);
  node.addEventListener("pointercancel", release);
  node.addEventListener("contextmenu", contextMenu);
  node.addEventListener("dragstart", dragStart);

  return {
    update(next: LongPressParams) {
      onLongPress = next.onLongPress;
      enabled = next.enabled ?? true;
      pick = next.pick;
      mark();
    },
    destroy() {
      release();
      node.removeEventListener("pointerdown", start);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", release);
      node.removeEventListener("contextmenu", contextMenu);
      node.removeEventListener("dragstart", dragStart);
    },
  };
}
