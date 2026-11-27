// Where the Library tab's domains land when they fan out above it: a half
// circle, opening between 160° and 20° so the outer ones clear the bar.
import { cubicOut } from "svelte/easing";

export interface FanPoint {
  dx: number;
  dy: number;
}

const FIRST_ANGLE = 160;
const SPREAD = 140;
const MAX_RADIUS = 140;
/** Half a domain's width, label included, kept inside the screen. */
const HALF_ITEM = 52;
/** How close a finger has to come to a domain to pick it. */
const PICK_DISTANCE = 46;

const COS_EDGE = Math.cos(((180 - FIRST_ANGLE) * Math.PI) / 180);

/** Smaller on a narrow phone, so the outer domains stay on screen. */
export function fanRadius(viewportWidth: number): number {
  return Math.max(
    80,
    Math.min(MAX_RADIUS, (viewportWidth / 2 - HALF_ITEM) / COS_EDGE),
  );
}

/** The fan's centre: under the tab, moved in when the tab is near an edge. */
export function fanOrigin(
  tabCentre: number,
  viewportWidth: number,
  radius: number,
): number {
  const reach = radius * COS_EDGE + HALF_ITEM;
  return Math.min(Math.max(tabCentre, reach), viewportWidth - reach);
}

export function fanPoints(count: number, radius: number): FanPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle =
      ((FIRST_ANGLE - ((i + 0.5) * SPREAD) / count) * Math.PI) / 180;
    return {
      dx: Math.round(radius * Math.cos(angle)),
      dy: Math.round(-radius * Math.sin(angle)),
    };
  });
}

/** The domain under a dragging finger, or -1. */
export function fanHit(
  points: FanPoint[],
  origin: { x: number; y: number },
  pointer: { x: number; y: number },
): number {
  let best = -1;
  let bestDistance = PICK_DISTANCE;
  points.forEach((point, index) => {
    const distance = Math.hypot(
      pointer.x - (origin.x + point.dx),
      pointer.y - (origin.y + point.dy),
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * A fan item flying out of its origin, `dx`/`dy` away: the Library tab's
 * domains and the edge tab's Alerts and Messages.
 */
export function fanBurst(
  _node: Element,
  {
    dx,
    dy,
    delay = 0,
    reduced = false,
  }: { dx: number; dy: number; delay?: number; reduced?: boolean },
) {
  return {
    delay: reduced ? 0 : delay,
    duration: reduced ? 0 : 220,
    easing: cubicOut,
    css: (t: number) =>
      `transform: translate(${-dx * (1 - t)}px, ${-dy * (1 - t)}px) scale(${0.4 + 0.6 * t}); opacity: ${t}`,
  };
}
