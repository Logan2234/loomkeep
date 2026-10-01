import { afterEach, beforeEach, vi } from "vitest";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { ApiRateLimitService } from "./api-rate-limit.service";

function setup({ premiumOffered = false, premium = false } = {}) {
  const entitlements = { hasPremium: vi.fn().mockResolvedValue(premium) };
  const flags = { isEnabled: vi.fn().mockReturnValue(premiumOffered) };
  const service = new ApiRateLimitService(
    entitlements as unknown as EntitlementService,
    flags as unknown as FeatureFlagsService,
  );
  return { service, entitlements };
}

describe("ApiRateLimitService", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-01T12:00:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("allows 60 requests a minute, then refuses until the window resets", async () => {
    const { service } = setup();

    for (let i = 0; i < 60; i++) {
      expect((await service.consume("user-1")).allowed).toBe(true);
    }

    const refused = await service.consume("user-1");
    expect(refused).toEqual({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetIn: 60,
    });

    vi.advanceTimersByTime(60_000);
    expect(await service.consume("user-1")).toMatchObject({
      allowed: true,
      remaining: 59,
    });
  });

  it("counts each account on its own", async () => {
    const { service } = setup();

    for (let i = 0; i < 60; i++) await service.consume("user-1");
    expect((await service.consume("user-2")).allowed).toBe(true);
  });

  it("raises the limit to 300 for premium once premium is offered", async () => {
    const { service } = setup({ premiumOffered: true, premium: true });

    expect(await service.limitFor("user-1")).toBe(300);
    expect(await service.quota("user-1")).toEqual({
      perMinute: 300,
      premiumPerMinute: null,
    });
  });

  it("points a free account at the premium limit only once premium is offered", async () => {
    expect(
      await setup({ premiumOffered: true }).service.quota("user-1"),
    ).toEqual({ perMinute: 60, premiumPerMinute: 300 });
    expect(await setup().service.quota("user-1")).toEqual({
      perMinute: 60,
      premiumPerMinute: null,
    });
  });

  it("keeps the free limit while premium isn't offered, whatever the plan", async () => {
    const { service, entitlements } = setup({ premium: true });

    expect(await service.limitFor("user-1")).toBe(60);
    expect(entitlements.hasPremium).not.toHaveBeenCalled();
  });
});
