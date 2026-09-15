import { Domain, ErrorCode, type ImportSource } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { EventsGateway } from "../events/events.gateway";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ImportJobService } from "./import-job.service";
import type { ImportReq } from "./import-source";

// Stubbed no-op, same pattern as library.service.spec.ts (G1).
function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

function stubEvents(): EventsGateway {
  return { emitToUser: vi.fn() } as unknown as EventsGateway;
}

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
        stubXp(),
        stubAchievements(),
        stubEvents(),
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
      stubXp(),
      stubAchievements(),
      stubEvents(),
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
      stubXp(),
      stubAchievements(),
      stubEvents(),
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
    source.buildPlan = vi.fn(() => new Promise<never>(() => undefined));
    const service = new ImportJobService(
      [source],
      {
        importRun: { findFirst: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
      {} as ConfigService,
      {
        isEffectivelyPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      stubXp(),
      stubAchievements(),
      stubEvents(),
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
      stubXp(),
      stubAchievements(),
      stubEvents(),
    );

    await expect(service.getQuota("u1")).resolves.toEqual({
      MEDIA: true,
      BOOKS: true,
    });
  });
});

describe("ImportJobService.commit — IMPORT_COMPLETED", () => {
  function makeCommitService(commitImpl: ImportReq["commit"]) {
    const source = fakeSource("tvtime");
    source.commit = commitImpl;
    const importRunCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      importRun: { create: importRunCreate },
    } as unknown as PrismaService;
    const xp = stubXp();
    const events = stubEvents();
    const service = new ImportJobService(
      [source],
      prisma,
      {} as unknown as ConfigService,
      {
        isEffectivelyPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      xp,
      stubAchievements(),
      events,
    );
    return { service, xp, events, importRunCreate };
  }

  // commit() only accepts a jobId that already has an analyzed plan attached
  // (set by startAnalyze) — seeded directly into the service's private job
  // map here rather than driving a full analyze pass through each test.
  function seedAnalyzedJob(service: ImportJobService, jobId: string): void {
    (service as unknown as { jobs: Map<string, unknown> }).jobs.set(jobId, {
      id: jobId,
      userId: "u1",
      sourceId: "tvtime",
      kind: "analyze",
      status: "completed",
      progress: { done: 0, total: 0 },
      plan: { groups: [] },
      report: null,
      error: null,
      errorCode: null,
      startedAt: Date.now(),
      finishedAt: Date.now(),
      parsed: {},
    });
  }

  it("awards IMPORT_COMPLETED once a commit succeeds, even with zero items imported", async () => {
    const { service, xp } = makeCommitService(async () => ({
      overwrite: false,
      tiles: [],
    }));
    seedAnalyzedJob(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      expect(xp.award).toHaveBeenCalledWith(
        "u1",
        "IMPORT_COMPLETED",
        Domain.MEDIA,
      );
    });
    expect(service.getJob("u1", job.id).status).toBe("completed");
  });

  it("does not award IMPORT_COMPLETED when the commit fails", async () => {
    const { service, xp, importRunCreate } = makeCommitService(async () => {
      throw new Error("boom");
    });
    seedAnalyzedJob(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      // recordRun (which would call xp.award) has finished once the audit
      // log write it always makes has happened, success or failure.
      expect(importRunCreate).toHaveBeenCalled();
    });
    expect(service.getJob("u1", job.id).status).toBe("failed");
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("pushes a final live progress update to the job's owner once it settles", async () => {
    const { service, events } = makeCommitService(async () => ({
      overwrite: false,
      tiles: [],
    }));
    seedAnalyzedJob(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      expect(events.emitToUser).toHaveBeenCalledWith(
        "u1",
        "import-progress",
        expect.objectContaining({ jobId: job.id, status: "completed" }),
      );
    });
  });
});

describe("ImportJobService — retained payloads", () => {
  type JobMap = Map<string, { parsed: unknown; plan: unknown; status: string }>;

  function jobs(service: ImportJobService): JobMap {
    return (service as unknown as { jobs: JobMap }).jobs;
  }

  function makeService(commitImpl?: ImportReq["commit"]) {
    const source = fakeSource("tvtime");
    if (commitImpl) source.commit = commitImpl;
    const prisma = {
      importRun: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    return new ImportJobService(
      [source],
      prisma,
      {} as unknown as ConfigService,
      {
        isEffectivelyPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      stubXp(),
      stubAchievements(),
      stubEvents(),
    );
  }

  function seedAnalyzed(
    service: ImportJobService,
    jobId: string,
    over: Record<string, unknown> = {},
  ): void {
    jobs(service).set(jobId, {
      id: jobId,
      userId: "u1",
      sourceId: "tvtime",
      kind: "analyze",
      status: "completed",
      progress: { done: 0, total: 0 },
      plan: { groups: [] },
      report: null,
      error: null,
      errorCode: null,
      startedAt: Date.now(),
      finishedAt: Date.now(),
      // Stands in for a full export model — bounded only by Fastify's 25 MB
      // body limit in production.
      parsed: { rows: "a big parse model" },
      ...over,
    } as never);
  }

  it("drops the parse model once its commit has succeeded", async () => {
    // It used to sit in memory for the full retention hour after the import
    // it belonged to was already done.
    const service = makeService(async () => ({ overwrite: false, tiles: [] }));
    seedAnalyzed(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      expect(service.getJob("u1", job.id).status).toBe("completed");
    });
    await vi.waitFor(() => {
      expect(jobs(service).get("analyzed-1")!.parsed).toBeNull();
    });
    expect(jobs(service).get("analyzed-1")!.plan).toBeNull();
  });

  it("keeps it when the commit failed, so the analysis stays retryable", async () => {
    const service = makeService(async () => {
      throw new Error("boom");
    });
    seedAnalyzed(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      expect(service.getJob("u1", job.id).status).toBe("failed");
    });
    expect(jobs(service).get("analyzed-1")!.parsed).not.toBeNull();
  });

  it("keeps only the newest analysis loaded when a new one starts", async () => {
    // The unbounded case: analysing repeatedly without committing retained up
    // to MAX_RETAINED_JOBS_PER_USER payloads at once.
    const service = makeService();
    seedAnalyzed(service, "old-1");
    seedAnalyzed(service, "old-2");

    await service.startAnalyze("u1", "tvtime", { input: {} } as never);

    expect(jobs(service).get("old-1")!.parsed).toBeNull();
    expect(jobs(service).get("old-2")!.parsed).toBeNull();
  });

  it("leaves a running job's payload alone", () => {
    // Releasing under a commit still reading it would break that import.
    // Driven directly: startAnalyze refuses outright while a job is running,
    // so that path can never reach a running job — this is the helper's own
    // invariant, for whoever calls it next.
    const service = makeService();
    seedAnalyzed(service, "running-1", { status: "running" });
    seedAnalyzed(service, "done-1");

    (
      service as unknown as { releasePayloads: (userId: string) => void }
    ).releasePayloads("u1");

    expect(jobs(service).get("running-1")!.parsed).not.toBeNull();
    expect(jobs(service).get("done-1")!.parsed).toBeNull();
  });

  it("keeps the job record itself, so its report stays readable", async () => {
    const service = makeService(async () => ({
      overwrite: false,
      tiles: [{ id: "series", label: "Séries", value: 3, sub: null }],
    }));
    seedAnalyzed(service, "analyzed-1");

    const job = service.commit("u1", "tvtime", "analyzed-1", {
      include: [],
    } as never);

    await vi.waitFor(() => {
      expect(service.getJob("u1", job.id).report).not.toBeNull();
    });
    expect(jobs(service).has("analyzed-1")).toBe(true);
  });
});
