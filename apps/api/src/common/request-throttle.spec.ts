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
