import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { QuotaTrackerService } from "./quota-tracker.service";

function makePrisma(upsert: Mock) {
  return { apiCallCounter: { upsert } } as unknown as PrismaService;
}

describe("QuotaTrackerService.record", () => {
  it("upserts today's UTC counter for the given provider", () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
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
