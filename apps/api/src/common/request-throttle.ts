/**
 * Serialises calls to at most one per `intervalMs`. Shared across every
 * caller of a single instance — the intended use is one instance per
 * provider, held for the app's lifetime, so the throttle applies
 * instance-wide (across every user of a self-hosted origin), not per-request.
 */
export class RequestThrottle {
  private lastRequestAt = 0;

  constructor(private readonly intervalMs: number) {}

  async wait(): Promise<void> {
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
