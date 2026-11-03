/** Upward travel before a touch on the bar counts as pulling the menu. */
const PULL_START = 10;

export const MENU_PULL_EVENT = "mobile-menu-pull";

/**
 * Swiping up on a bottom bar pulls the menu sheet up after the finger:
 * MenuSheet listens for `mobile-menu-pull`, carrying how far the finger went
 * up, then `null` once it lifts. A tap stays a tap, and an element marked
 * `data-no-menu-pull` (the Library tab, whose own drag picks a domain) keeps
 * its gestures.
 */
export function pullMenu(node: HTMLElement) {
  let start: { x: number; y: number; id: number } | null = null;
  let pulling = false;

  function pull(distance: number | null) {
    dispatchEvent(new CustomEvent(MENU_PULL_EVENT, { detail: distance }));
  }

  function onDown(event: PointerEvent) {
    if (start || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as Element).closest("[data-no-menu-pull]")) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
  }

  function onMove(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    const up = start.y - event.clientY;
    const across = Math.abs(event.clientX - start.x);

    if (!pulling) {
      if (up > PULL_START && across < up) {
        pulling = true;
        node.setPointerCapture?.(event.pointerId);
      } else {
        if (across > PULL_START || up < -PULL_START) finish();
        return;
      }
    }

    pull(Math.max(0, up));
  }

  function onUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;

    if (pulling) {
      pull(null);

      // The lift ends the pull: no tab underneath gets opened by it.
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };

      node.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() =>
        node.removeEventListener("click", swallow, { capture: true }),
      );
    }

    finish();
  }

  function finish() {
    start = null;
    pulling = false;
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
  }

  node.addEventListener("pointerdown", onDown);
  return {
    destroy() {
      node.removeEventListener("pointerdown", onDown);
      finish();
    },
  };
}
