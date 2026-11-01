// A drag that ends fast enough dismisses even when it's short, like Android's
// own sheets and snackbars: judging the distance alone made the natural
// gesture, a quick flick, snap back.

/** Release speed (px/ms) past which a flick dismisses, whatever its length. */
const FLICK_VELOCITY = 0.5;

/** Only the end of the gesture counts: a finger that stopped before lifting isn't flicking. */
const VELOCITY_WINDOW_MS = 100;

export class DragVelocity {
  #samples: { at: number; position: number }[] = [];

  reset(): void {
    this.#samples = [];
  }

  add(position: number, at: number): void {
    this.#samples.push({ at, position });
    while (
      this.#samples.length > 2 &&
      at - this.#samples[0].at > VELOCITY_WINDOW_MS
    )
      this.#samples.shift();
  }

  /** Speed in px/ms over the gesture's last moments, signed like the positions. */
  at(now: number): number {
    const recent = this.#samples.filter(
      (s) => now - s.at <= VELOCITY_WINDOW_MS,
    );
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    return last.at === first.at
      ? 0
      : (last.position - first.position) / (last.at - first.at);
  }
}

/** The slowest and fastest a sheet takes to finish a gesture, in ms. */
const SETTLE_MIN_MS = 150;
const SETTLE_MAX_MS = 300;
/** Below this speed (px/ms) the release carries no momentum worth matching. */
const SETTLE_MIN_SPEED = 0.2;

/** How long to cover what's left at the speed the finger left it. */
export function settleDuration(remaining: number, velocity: number): number {
  const speed = Math.abs(velocity);
  if (speed < SETTLE_MIN_SPEED) return SETTLE_MAX_MS;
  return Math.round(
    Math.min(SETTLE_MAX_MS, Math.max(SETTLE_MIN_MS, remaining / speed)),
  );
}

export type SheetStop = "full" | "half" | "closed";

/**
 * Where a sheet with a half-open stop goes on release. `position` is how far
 * below fully open it was let go and `from` the stop the drag began at: a
 * flick moves one stop in its direction, otherwise the nearest stop wins.
 */
export function sheetStop({
  position,
  halfAt,
  size,
  velocity,
  from,
  fraction,
}: {
  position: number;
  halfAt: number;
  size: number;
  velocity: number;
  from: "full" | "half";
  fraction: number;
}): SheetStop {
  if (velocity < -FLICK_VELOCITY) return "full";
  if (velocity > FLICK_VELOCITY) return from === "full" ? "half" : "closed";
  if (position < halfAt / 2) return "full";
  return position > halfAt + (size - halfAt) * fraction ? "closed" : "half";
}

/**
 * Whether a released drag dismisses. `distance` and `velocity` are measured
 * in the dismissing direction (positive = towards dismissal).
 */
export function isDismissed({
  distance,
  size,
  velocity,
  fraction,
}: {
  distance: number;
  size: number;
  velocity: number;
  fraction: number;
}): boolean {
  if (distance <= 0) return false;
  return distance / size > fraction || velocity > FLICK_VELOCITY;
}
