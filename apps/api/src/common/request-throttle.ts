import { sleep } from "./async.util";

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
 *
 * {@link pauseFor} holds every queued call back once a provider has banned
 * the instance for a while: a request sent during the ban only fails, and
 * can prolong it.
 */
export class RequestThrottle {
  private lastRequestAt = 0;
  private pausedUntil = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly intervalMs: number) {}

  wait(): Promise<void> {
    this.queue = this.queue.then(() => this.takeTurn());
    return this.queue;
  }

  /** No call goes out for the next `ms` (a pause never shortens). */
  pauseFor(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
  }

  /** How long the current pause still runs, 0 when there is none. */
  remainingPauseMs(): number {
    return Math.max(0, this.pausedUntil - Date.now());
  }

  /** Only ever runs one at a time, so this read-sleep-write is atomic. */
  private async takeTurn(): Promise<void> {
    const now = Date.now();
    const readyAt = Math.max(
      this.lastRequestAt + this.intervalMs,
      this.pausedUntil,
    );

    if (readyAt > now) {
      await sleep(readyAt - now);
    }

    this.lastRequestAt = Date.now();
  }
}
