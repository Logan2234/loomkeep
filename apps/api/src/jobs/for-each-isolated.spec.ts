import type { Logger } from "@nestjs/common";
import { vi } from "vitest";
import { forEachIsolated } from "./for-each-isolated";

const logger = () =>
  ({ error: vi.fn() }) as unknown as Logger & {
    error: ReturnType<typeof vi.fn>;
  };

describe("forEachIsolated", () => {
  it("goes on after a failure, and counts and logs it", async () => {
    const log = logger();
    const seen: number[] = [];

    const run = await forEachIsolated(
      [1, 2, 3],
      async (n) => {
        seen.push(n);
        if (n === 2) throw new Error("boom");
      },
      { logger: log, label: (n) => `item ${n}` },
    );

    expect(seen).toEqual([1, 2, 3]);
    expect(run).toEqual({ succeeded: 2, failed: 1 });
    expect(log.error).toHaveBeenCalledWith("item 2 failed", expect.any(Error));
  });

  it("doesn't count an item its function skipped", async () => {
    const run = await forEachIsolated([1, 2], async (n) => n === 1, {
      logger: logger(),
      label: String,
    });

    expect(run).toEqual({ succeeded: 1, failed: 0 });
  });

  it("runs one at a time unless told otherwise", async () => {
    let inFlight = 0;
    let peak = 0;

    const work = async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight--;
    };

    await forEachIsolated([1, 2, 3, 4], work, {
      logger: logger(),
      label: String,
    });
    expect(peak).toBe(1);

    peak = 0;
    await forEachIsolated([1, 2, 3, 4], work, {
      logger: logger(),
      label: String,
      concurrency: 2,
    });
    expect(peak).toBe(2);
  });
});
