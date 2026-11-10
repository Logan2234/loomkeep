import type { CreatorRefDto } from "@loomkeep/shared";
import { PeekTimer } from "./peek-timer";

export interface PeekTarget {
  anchor: HTMLElement;
  ref: Pick<CreatorRefDto, "source" | "id" | "name">;
  /** What they did on the work being viewed: a character, "Director"… */
  role?: string | null;
  /** Shown until the page's own photo arrives. */
  photoUrl?: string | null;
}

/** The one peek on screen, read by CreatorPeek (mounted once in the app layout). */
export const peek = $state<{ target: PeekTarget | null; open: boolean }>({
  target: null,
  open: false,
});

const timer = new PeekTimer<PeekTarget>((target, open) => {
  peek.target = target;
  peek.open = open;
});

export const peekPanel = {
  hold: () => timer.hold(),
  leave: () => timer.leave(),
  close: () => timer.close(),
};

/**
 * Peeks at the creator a link leads to after a steady hover or a keyboard
 * focus. A finger has no hover: its tap just follows the link.
 */
export function creatorPeek(
  node: HTMLElement,
  params: Omit<PeekTarget, "anchor">,
) {
  let target: PeekTarget = { ...params, anchor: node };

  const enter = (e: PointerEvent) => {
    if (e.pointerType !== "touch") timer.enter(target);
  };

  const leave = (e: PointerEvent) => {
    if (e.pointerType !== "touch") timer.leave();
  };

  const focus = () => {
    if (node.matches(":focus-visible")) timer.enter(target);
  };

  const blur = () => timer.leave();

  node.addEventListener("pointerenter", enter);
  node.addEventListener("pointerleave", leave);
  node.addEventListener("focus", focus);
  node.addEventListener("blur", blur);

  return {
    update(next: Omit<PeekTarget, "anchor">) {
      target = { ...next, anchor: node };
    },
    destroy() {
      if (peek.target?.anchor === node) timer.close();
      node.removeEventListener("pointerenter", enter);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("focus", focus);
      node.removeEventListener("blur", blur);
    },
  };
}
