import { Domain } from "@loomkeep/shared";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainGateService } from "./domain-gate.service";

describe("DomainGateService", () => {
  function makeService(
    enabledDomains: Domain[] | null,
    maintenanceDomains: Domain[] = [],
    hasPremium = true,
  ) {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            enabledDomains === null ? null : { enabledDomains },
          ),
      },
    } as unknown as PrismaService;
    const flags = {
      isEnabled: vi.fn(
        (name: string, fallback: boolean) =>
          maintenanceDomains.some((d) => name === `MAINTENANCE_${d}`) ||
          fallback,
      ),
    } as unknown as FeatureFlagsService;
    const entitlements = {
      isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
    } as unknown as EntitlementService;
    return new DomainGateService(prisma, flags, entitlements);
  }

  it("resolves when the domain is enabled", async () => {
    const service = makeService([Domain.MEDIA, Domain.GAMES]);
    await expect(
      service.assertEnabled("u1", Domain.GAMES),
    ).resolves.toBeUndefined();
  });

  it("throws 403 when the domain is disabled", async () => {
    const service = makeService([Domain.MEDIA]);
    await expect(
      service.assertEnabled("u1", Domain.BOOKS),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("throws 403 when the user does not exist", async () => {
    const service = makeService(null);
    await expect(
      service.assertEnabled("nope", Domain.MEDIA),
    ).rejects.toBeInstanceOf(AppException);
  });

  describe("getEnabledDomains", () => {
    it("returns the user's enabled domains", async () => {
      const service = makeService([Domain.MEDIA, Domain.BOOKS]);
      await expect(service.getEnabledDomains("u1")).resolves.toEqual([
        Domain.MEDIA,
        Domain.BOOKS,
      ]);
    });

    it("returns an empty array when the user does not exist", async () => {
      const service = makeService(null);
      await expect(service.getEnabledDomains("nope")).resolves.toEqual([]);
    });

    it("excludes a domain under MAINTENANCE_<DOMAIN>, even if the user enabled it", async () => {
      const service = makeService([Domain.MEDIA, Domain.BOOKS], [Domain.BOOKS]);
      await expect(service.getEnabledDomains("u1")).resolves.toEqual([
        Domain.MEDIA,
      ]);
    });
  });

  it("throws 403 for a domain under maintenance, even if the user enabled it", async () => {
    const service = makeService([Domain.BOOKS], [Domain.BOOKS]);
    await expect(
      service.assertEnabled("u1", Domain.BOOKS),
    ).rejects.toBeInstanceOf(AppException);
  });

  describe("premium-gated domains", () => {
    it("allows a premium-gated domain for a premium user", async () => {
      const service = makeService([Domain.MEDIA, Domain.MUSIC], [], true);
      await expect(
        service.assertEnabled("u1", Domain.MUSIC),
      ).resolves.toBeUndefined();
    });

    it("throws 403 for a premium-gated domain the user enabled, but isn't premium", async () => {
      const service = makeService([Domain.MEDIA, Domain.MUSIC], [], false);
      await expect(
        service.assertEnabled("u1", Domain.MUSIC),
      ).rejects.toBeInstanceOf(AppException);
    });

    it("excludes premium-gated domains from getEnabledDomains for a non-premium user", async () => {
      const service = makeService(
        [Domain.MEDIA, Domain.MUSIC, Domain.BOOKS],
        [],
        false,
      );
      await expect(service.getEnabledDomains("u1")).resolves.toEqual([
        Domain.MEDIA,
        Domain.BOOKS,
      ]);
    });

    it("does not check premium at all when no enabled domain requires it", async () => {
      const service = makeService([Domain.MEDIA, Domain.BOOKS], [], false);
      await service.getEnabledDomains("u1");
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).entitlements.isEffectivelyPremium,
      ).not.toHaveBeenCalled();
    });
  });
});
