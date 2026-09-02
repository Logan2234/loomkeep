import { Domain, ErrorCode, type ImportSource } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
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

describe("ImportJobService translatable failures", () => {
  it.each([
    [
      new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ImportSteamLibraryPrivate,
      ),
      ErrorCode.ImportSteamLibraryPrivate,
    ],
    [
      new Error("Title: provider failure", {
        cause: new AppException(
          HttpStatus.BAD_GATEWAY,
          ErrorCode.ImportSourceUnavailable,
        ),
      }),
      ErrorCode.ImportSourceUnavailable,
    ],
    [new Error("Internal diagnostic"), ErrorCode.InternalError],
  ])(
    "preserves a stable code for background failures",
    async (failure, code) => {
      const source = fakeSource("steam");
      source.buildPlan = vi.fn().mockRejectedValue(failure);
      const service = new ImportJobService(
        [source],
        {} as PrismaService,
        {} as ConfigService,
        {
          isEffectivelyPremium: vi.fn().mockResolvedValue(true),
        } as unknown as EntitlementService,
      );
      const started = await service.startAnalyze("u1", "steam", { input: "" });
      await vi.waitFor(() => {
        expect(service.getJob("u1", started.id)).toMatchObject({
          status: "failed",
          errorCode: code,
        });
      });
    },
  );
});

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

  it("rejects a second concurrent import for the same user", async () => {
    const source = fakeSource("tvtime");
    source.buildPlan = vi.fn(() => new Promise(() => undefined));
    const service = new ImportJobService(
      [source],
      {
        importRun: { findFirst: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      {} as ConfigService,
      {
        isEffectivelyPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
    );

    await service.startAnalyze("u1", "tvtime", { input: "" });

    await expect(
      service.startAnalyze("u1", "tvtime", { input: "" }),
    ).rejects.toBeInstanceOf(AppException);
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
