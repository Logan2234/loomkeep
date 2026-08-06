import { ForbiddenException } from "@nestjs/common";
import { Domain } from "@loomkeep/shared";
import { PrismaService } from "../prisma/prisma.service";
import { DomainGateService } from "./domain-gate.service";

describe("DomainGateService", () => {
  function makeService(enabledDomains: Domain[] | null) {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            enabledDomains === null ? null : { enabledDomains },
          ),
      },
    } as unknown as PrismaService;
    return new DomainGateService(prisma);
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
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws 403 when the user does not exist", async () => {
    const service = makeService(null);
    await expect(
      service.assertEnabled("nope", Domain.MEDIA),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
  });
});
