import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { PrismaService } from "../prisma/prisma.service";
import { EntitlementService } from "./entitlement.service";

describe("EntitlementService.isEffectivelyPremium", () => {
  function makeService(plan: "FREE" | "PREMIUM", flagEnabled: boolean) {
    const prisma = {
      userEntitlement: {
        upsert: jest.fn().mockResolvedValue({ plan }),
      },
    } as unknown as PrismaService;
    const flags = {
      isEnabled: jest.fn().mockReturnValue(flagEnabled),
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
});
