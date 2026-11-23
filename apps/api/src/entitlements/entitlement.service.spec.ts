import { vi } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "./entitlement.service";

describe("EntitlementService.isEffectivelyPremium", () => {
  function makeService(plan: "FREE" | "PREMIUM", flagEnabled: boolean) {
    const prisma = {
      userEntitlement: {
        upsert: vi.fn().mockResolvedValue({ plan }),
      },
    } as unknown as PrismaService;
    const flags = {
      isEnabled: vi.fn().mockReturnValue(flagEnabled),
    } as unknown as FeatureFlagsService;
    return new EntitlementService(prisma, flags);
  }

  it("treats every user as premium when the premium-features flag is off, regardless of plan", async () => {
    const service = makeService("FREE", false);
    await expect(service.isEffectivelyPremium("u1")).resolves.toBe(true);
  });

  it("falls back to the real plan when the premium-features flag is on", async () => {
    const free = makeService("FREE", true);
    await expect(free.isEffectivelyPremium("u1")).resolves.toBe(false);

    const premium = makeService("PREMIUM", true);
    await expect(premium.isEffectivelyPremium("u1")).resolves.toBe(true);
  });

  it("makes every account premium while the instance license says so", async () => {
    const service = makeService("FREE", true);
    let licensed = true;
    service.setInstancePremiumSource(() => licensed);

    await expect(service.isEffectivelyPremium("u1")).resolves.toBe(true);
    await expect(service.hasPremium("u1")).resolves.toBe(true);

    // Re-read on every check: an expired license stops granting at once.
    licensed = false;
    await expect(service.isEffectivelyPremium("u1")).resolves.toBe(false);
  });
});

// expiresAt was stored and exported but never read: a premium granted for a
// trial stayed premium for good (audit 2026-11-17, PRM-05).
describe("EntitlementService premium expiry", () => {
  const NOW = new Date("2026-11-23T12:00:00Z");

  function makeService(entitlement: { plan: string; expiresAt: Date | null }) {
    const upsert = vi.fn().mockResolvedValue(entitlement);
    const prisma = { userEntitlement: { upsert } } as unknown as PrismaService;
    const flags = {
      isEnabled: vi.fn().mockReturnValue(true),
    } as unknown as FeatureFlagsService;
    return { service: new EntitlementService(prisma, flags), upsert };
  }

  it("ends a premium plan once its expiry has passed", async () => {
    const { service } = makeService({
      plan: "PREMIUM",
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    });

    await expect(service.hasPremium("u1", NOW)).resolves.toBe(false);
  });

  it("keeps a premium plan until its expiry, or for good without one", async () => {
    const until = makeService({
      plan: "PREMIUM",
      expiresAt: new Date("2026-12-31T00:00:00Z"),
    });
    const forGood = makeService({ plan: "PREMIUM", expiresAt: null });

    await expect(until.service.hasPremium("u1", NOW)).resolves.toBe(true);
    await expect(forGood.service.hasPremium("u1", NOW)).resolves.toBe(true);
  });

  it("stores the expiry an admin grants premium with, and clears it on FREE", async () => {
    const { service, upsert } = makeService({
      plan: "PREMIUM",
      expiresAt: null,
    });
    const expiresAt = new Date("2026-12-31T23:59:59Z");

    await service.setPlan("u1", "PREMIUM", expiresAt);
    await service.setPlan("u1", "FREE", expiresAt);

    expect(upsert.mock.calls[0][0].update.expiresAt).toEqual(expiresAt);
    expect(upsert.mock.calls[0][0].create.expiresAt).toEqual(expiresAt);
    expect(upsert.mock.calls[1][0].update.expiresAt).toBeNull();
  });
});
