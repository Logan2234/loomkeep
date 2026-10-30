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
