/**
 * Serialises calls to at most one per `intervalMs`. Shared across every
 * caller of a single instance — the intended use is one instance per
 * provider, held for the app's lifetime, so the throttle applies
 * instance-wide (across every user of a self-hosted origin), not per-request.
 *
 * Callers queue behind one another rather than each computing its own delay:
 * concurrent callers reading the same `lastRequestAt` would all sleep the
 * same amount and then fire together, which is the one case the throttle
 * exists for. MusicBrainz's 1 req/s in particular is a hard rule, enforced
 * with temporary bans.
 */
export class RequestThrottle {
  private lastRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly intervalMs: number) {}

  wait(): Promise<void> {
    this.queue = this.queue.then(() => this.takeTurn());
    return this.queue;
  }

  /** Only ever runs one at a time, so this read-sleep-write is atomic. */
  private async takeTurn(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;

    if (elapsed < this.intervalMs) {
      await sleep(this.intervalMs - elapsed);
    }

    this.lastRequestAt = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
