import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  QuotaTrackerService,
  type QuotaThresholdReached,
} from "./quota-tracker.service";

function makePrisma(upsert: Mock) {
  return { apiCallCounter: { upsert } } as unknown as PrismaService;
}

describe("QuotaTrackerService.record", () => {
  it("upserts today's UTC counter for the given provider", () => {
    const upsert = vi.fn().mockResolvedValue({ count: 1 });
    const service = new QuotaTrackerService(makePrisma(upsert));

    service.record("tmdb");

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where.provider_day.provider).toBe("tmdb");
    expect(call.where.provider_day.day.getUTCHours()).toBe(0);
    expect(call.update).toEqual({ count: { increment: 1 } });
    expect(call.create).toEqual({
      provider: "tmdb",
      day: call.where.provider_day.day,
      count: 1,
    });
  });

  it("never throws when the upsert fails (best-effort counting)", () => {
    const upsert = vi.fn().mockRejectedValue(new Error("db down"));
    const service = new QuotaTrackerService(makePrisma(upsert));

    expect(() => service.record("tmdb")).not.toThrow();
  });
});

describe("QuotaTrackerService thresholds", () => {
  /** Records one call that brings `provider`'s daily counter to `count`. */
  async function reach(provider: string, count: number) {
    const upsert = vi.fn().mockResolvedValue({ count });
    const service = new QuotaTrackerService(makePrisma(upsert));
    const reached: QuotaThresholdReached[] = [];
    service.onThresholdReached((event) => reached.push(event));

    service.record(provider);
    await vi.waitFor(() => expect(upsert).toHaveBeenCalled());
    // Let the fire-and-forget upsert's continuation run.
    await new Promise((resolve) => setImmediate(resolve));
    return reached;
  }

  it("raises the 80% threshold on the call that reaches it", async () => {
    expect(await reach("omdb", 800)).toEqual([
      { provider: "omdb", count: 800, limit: 1000, threshold: 0.8 },
    ]);
  });

  it("raises it once: the calls after it stay quiet", async () => {
    // Each counter value comes back from exactly one increment, so equality
    // is what makes a threshold fire once a day, even under concurrent calls.
    expect(await reach("omdb", 801)).toEqual([]);
  });

  it("raises the 100% threshold when the quota is used up", async () => {
    expect(await reach("smtp", 300)).toEqual([
      { provider: "smtp", count: 300, limit: 300, threshold: 1 },
    ]);
  });

  it("stays quiet for a provider with no documented daily quota", async () => {
    // TMDB limits requests per second, not per day.
    expect(await reach("tmdb", 1_000_000)).toEqual([]);
  });
});
