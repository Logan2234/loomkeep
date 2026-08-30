import { Domain, ErrorCode, type ImportSource } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ImportJobService } from "./import-job.service";
import type { ImportReq } from "./import-source";

function fakeSource(id: ImportSource, requiredEnvKeys?: string[]): ImportReq {
  return {
    id,
    searchDomain: Domain.MEDIA,
    supportsOverwrite: false,
    requiredEnvKeys,
    parseInput: () => ({}),
    buildPlan: async () => ({
      groups: [],
      counts: { total: 0, matched: 0, unresolved: 0, apiErrors: 0 },
      searchDomain: Domain.MEDIA,
    }),
    commit: async () => ({ overwrite: false, tiles: [] }),
  };
}

describe("ImportJobService.getAvailability", () => {
  it("omits sources with no required env keys, and reports configured/unconfigured ones", () => {
    const config = {
      get: vi.fn((key: string) => (key === "SET_KEY" ? "value" : undefined)),
    };
    const service = new ImportJobService(
      [
        fakeSource("tvtime"), // no config of its own
        fakeSource("trakt", ["SET_KEY"]),
        fakeSource("simkl", ["SET_KEY", "MISSING_KEY"]),
      ],
      {} as PrismaService,
      config as unknown as ConfigService,
      { isEffectivelyPremium: vi.fn() } as unknown as EntitlementService,
    );

    const availability = service.getAvailability();

    expect(availability).toEqual({
      trakt: true,
      simkl: false,
    });
    expect(availability.tvtime).toBeUndefined();
  });
});

describe("ImportJobService.startAnalyze — premium gating", () => {
  function makeService(
    hasPremium: boolean,
    priorRun: { status: string; itemCount: number } | null,
  ) {
    const prisma = {
      importRun: {
        findFirst: vi.fn().mockResolvedValue(priorRun),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const entitlements = {
      isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
    } as unknown as EntitlementService;
    const service = new ImportJobService(
      [fakeSource("tvtime")],
      prisma,
      {} as unknown as ConfigService,
      entitlements,
    );
    return { service, prisma };
  }

  it("allows a first import into a domain for a free account", async () => {
    const { service } = makeService(false, null);
    await expect(
      service.startAnalyze("u1", "tvtime", { input: "" }),
    ).resolves.toMatchObject({ status: "running" });
  });

  it("rejects a second import into an already-imported domain for a free account", async () => {
    const { service } = makeService(false, {
      status: "SUCCESS",
      itemCount: 5,
    });
    await expect(
      service.startAnalyze("u1", "tvtime", { input: "" }),
    ).rejects.toMatchObject({ code: ErrorCode.ImportFreeQuotaExceeded });
  });

  it("allows any import for a premium account, even with prior history", async () => {
    const { service } = makeService(true, { status: "SUCCESS", itemCount: 5 });
    await expect(
      service.startAnalyze("u1", "tvtime", { input: "" }),
    ).resolves.toMatchObject({ status: "running" });
  });

  it("only counts a prior run with items actually written towards the free import", async () => {
    const { service, prisma } = makeService(false, null);
    await expect(
      service.startAnalyze("u1", "tvtime", { input: "" }),
    ).resolves.toMatchObject({ status: "running" });
    expect(prisma.importRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ itemCount: { gt: 0 } }),
      }),
    );
  });
});

describe("ImportJobService.getQuota", () => {
  it("maps every domain with a recorded successful import to true", async () => {
    const prisma = {
      importRun: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ domain: "MEDIA" }, { domain: "BOOKS" }]),
      },
    } as unknown as PrismaService;
    const service = new ImportJobService(
      [fakeSource("tvtime")],
      prisma,
      {} as unknown as ConfigService,
      {} as unknown as EntitlementService,
    );

    await expect(service.getQuota("u1")).resolves.toEqual({
      MEDIA: true,
      BOOKS: true,
    });
  });
});
