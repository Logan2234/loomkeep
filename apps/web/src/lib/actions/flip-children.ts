import type { Action } from "svelte/action";

type FlipOptions = { duration: number };
type Position = { x: number; y: number };

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * FLIP for the children of a long, keyed list (hundreds of tiles), where
 * `animate:flip` measures and animates each child in turn and stalls the
 * page. Positions are read in one pass after Svelte has moved the nodes, and
 * only the children near the visible part of the container are animated.
 * Offsets rather than client rects, so scrolling and running animations
 * don't skew the deltas. The container must be the children's offsetParent
 * (`position: relative`).
 */
export const flipChildren: Action<HTMLElement, FlipOptions> = (
  node,
  options,
) => {
  let duration = options.duration;

  const measure = () => {
    const positions = new Map<Element, Position>();

    for (const child of node.children) {
      if (child instanceof HTMLElement) {
        positions.set(child, { x: child.offsetLeft, y: child.offsetTop });
      }
    }

    return positions;
  };

  let positions = measure();

  const observer = new MutationObserver(() => {
    const next = measure();

    if (duration > 0) {
      const top = node.scrollTop - node.clientHeight;
      const bottom = node.scrollTop + node.clientHeight * 2;

      for (const [child, to] of next) {
        if (to.y < top || to.y > bottom) continue;
        const from = positions.get(child);

        if (!from) {
          child.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration,
            easing: EASING,
          });
        } else if (from.x !== to.x || from.y !== to.y) {
          child.animate(
            [
              {
                transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)`,
              },
              { transform: "none" },
            ],
            { duration, easing: EASING },
          );
        }
      }
    }

    positions = next;
  });
  observer.observe(node, { childList: true });

  return {
    update(next) {
      duration = next.duration;
    },
    destroy() {
      observer.disconnect();
    },
  };
};
