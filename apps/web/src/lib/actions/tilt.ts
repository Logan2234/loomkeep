import { prefersReducedMotion } from "$lib/motion";

type TiltParams = {
  /** Rotation in degrees at the node's edge. */
  maxDeg?: number;
  /** Scale applied while the pointer is over the node. */
  scale?: number;
};

const SETTLE_MS = 350;

function transformFor(rx: number, ry: number, scale: number): string {
  return `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
}

/**
 * Generic Svelte action: tilts the node in 3D toward the pointer's position
 * over it, like a medal catching the light — attach with `use:tilt` and it
 * moves on its own, the same "just works" contract as `transition:`/
 * `animate:` (no CSS required from the consumer for the motion itself; a
 * consumer that also wants child elements to visibly lift needs its own
 * `transform-style: preserve-3d` + `translateZ()`, which is a presentation
 * choice this action doesn't make for it).
 *
 * No-ops entirely under prefers-reduced-motion — same rule as every other
 * motion in the app (see `$lib/motion`), not a reduced version of the tilt.
 */
export function tilt(node: HTMLElement, params: TiltParams = {}) {
  let { maxDeg = 12, scale = 1.06 } = params;
  if (prefersReducedMotion()) return {};

  function move(e: PointerEvent) {
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 2 * maxDeg;
    const rx = (0.5 - py) * 2 * maxDeg;
    node.style.transition = "none";
    node.style.transform = transformFor(rx, ry, scale);
  }

  function leave() {
    node.style.transition = `transform ${SETTLE_MS}ms ease`;
    node.style.transform = transformFor(0, 0, 1);
  }

  node.addEventListener("pointermove", move);
  node.addEventListener("pointerleave", leave);

  return {
    update(next: TiltParams) {
      maxDeg = next.maxDeg ?? 12;
      scale = next.scale ?? 1.06;
    },
    destroy() {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    },
  };
}
