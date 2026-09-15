import { vi } from "vitest";
import { RequestThrottle } from "./request-throttle";

describe("RequestThrottle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not delay the first call", async () => {
    // Well clear of the interval's own magnitude, so the very first call
    // (elapsed = Date.now() - 0) doesn't collide with a low mocked value.
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const throttle = new RequestThrottle(1000);
    const sleepSpy = vi.spyOn(global, "setTimeout");

    await throttle.wait();

    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it("delays a call that comes before intervalMs has elapsed", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const throttle = new RequestThrottle(1000);

    await throttle.wait(); // now = 0, sets lastRequestAt = 0

    now = 200; // only 200ms elapsed, interval is 1000ms
    const sleepSpy = vi.spyOn(global, "setTimeout").mockImplementation(((
      fn: () => void,
    ) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);

    await throttle.wait();

    expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 800);
  });

  it("spaces concurrent callers instead of releasing them together", async () => {
    // The regression: each caller used to read the same lastRequestAt, sleep
    // the same amount and fire at once — so N parallel calls cost one slot,
    // not N. MusicBrainz bans for that.
    vi.useFakeTimers();

    try {
      const throttle = new RequestThrottle(1000);
      const releasedAt: number[] = [];
      const calls = [0, 1, 2].map(() =>
        throttle.wait().then(() => releasedAt.push(Date.now())),
      );

      await vi.advanceTimersByTimeAsync(3000);
      await Promise.all(calls);

      const start = releasedAt[0];
      expect(releasedAt.map((t) => t - start)).toEqual([0, 1000, 2000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not delay a call that comes after intervalMs has elapsed", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const throttle = new RequestThrottle(1000);

    await throttle.wait();

    now = 1500;
    const sleepSpy = vi.spyOn(global, "setTimeout");

    await throttle.wait();

    expect(sleepSpy).not.toHaveBeenCalled();
  });
});
