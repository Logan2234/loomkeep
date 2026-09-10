import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { JOB_KEYS } from "./job-keys";
import { JobRunService } from "./job-run.service";

function makeService() {
  const prisma = {
    jobRun: {
      create: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
  };

  return {
    service: new JobRunService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe("JobRunService.record — Healthchecks.io ping", () => {
  const ENV_VAR = "HEALTHCHECKS_BACKUP_URL";
  const PING_URL = "https://hc-ping.com/some-uuid";
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env[ENV_VAR];
  });

  it("pings the plain URL on success", async () => {
    process.env[ENV_VAR] = PING_URL;
    const { service } = makeService();

    await service.record(
      JOB_KEYS.BACKUP,
      async () => "ok",
      () => "summary",
    );

    expect(fetchMock).toHaveBeenCalledWith(PING_URL);
  });

  it("pings the /fail URL on failure, then still rethrows", async () => {
    process.env[ENV_VAR] = PING_URL;
    const { service } = makeService();

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => {
          throw new Error("boom");
        },
        () => "summary",
      ),
    ).rejects.toThrow("boom");

    expect(fetchMock).toHaveBeenCalledWith(`${PING_URL}/fail`);
  });

  it("stores a run id and the full stack in JobRun.error on failure", async () => {
    const { service, prisma } = makeService();

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => {
          throw new Error("boom");
        },
        () => "summary",
      ),
    ).rejects.toThrow("boom");

    const data = (prisma.jobRun.create as Mock).mock.calls[0][0].data;
    // "[<8 hex chars>] Error: boom" followed by the rest of the stack trace.
    expect(data.error).toMatch(/^\[[0-9a-f]{8}\] Error: boom\n/);
  });

  it("skips pinging when no URL is configured for the job", async () => {
    const { service } = makeService();

    await service.record(
      JOB_KEYS.BACKUP,
      async () => "ok",
      () => "summary",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows ping failures without affecting the job's own result", async () => {
    process.env[ENV_VAR] = PING_URL;
    fetchMock.mockRejectedValue(new Error("network down"));
    const { service } = makeService();

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => "ok",
        () => "summary",
      ),
    ).resolves.toBe("ok");
  });
});
