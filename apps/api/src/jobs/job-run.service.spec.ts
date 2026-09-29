import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { JobAlertService } from "./job-alert.service";
import { JOB_KEYS } from "./job-keys";
import { JobRunService } from "./job-run.service";

function makeService(previousStatus?: "SUCCESS" | "FAILURE") {
  const prisma = {
    jobRun: {
      create: vi.fn().mockResolvedValue(undefined),
      findFirst: vi
        .fn()
        .mockResolvedValue(previousStatus ? { status: previousStatus } : null),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
  };
  const alerts = {
    jobFailed: vi.fn().mockResolvedValue(undefined),
    jobRecovered: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new JobRunService(
      prisma as unknown as PrismaService,
      alerts as unknown as JobAlertService,
    ),
    prisma,
    alerts,
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

describe("JobRunService.record — run history", () => {
  it("persists a successful run and prunes only that job's old rows", async () => {
    const { service, prisma } = makeService();
    prisma.jobRun.findMany.mockResolvedValue([{ id: "old-1" }]);

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => "completed",
        (result) => `Backup ${result}`,
      ),
    ).resolves.toBe("completed");

    expect(prisma.jobRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobKey: JOB_KEYS.BACKUP,
        status: "SUCCESS",
        summary: "Backup completed",
        startedAt: expect.any(Date),
        finishedAt: expect.any(Date),
      }),
    });
    expect(prisma.jobRun.findMany).toHaveBeenCalledWith({
      where: { jobKey: JOB_KEYS.BACKUP },
      orderBy: { startedAt: "desc" },
      skip: 50,
      select: { id: true },
    });
    expect(prisma.jobRun.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-1"] } },
    });
  });

  it("persists a failed run and rethrows the original error", async () => {
    const { service, prisma } = makeService();
    const failure = new Error("backup failed");

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => {
          throw failure;
        },
        () => "not reached",
      ),
    ).rejects.toBe(failure);

    expect(prisma.jobRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobKey: JOB_KEYS.BACKUP,
        status: "FAILURE",
        error: expect.stringContaining("backup failed"),
      }),
    });
    expect(prisma.jobRun.deleteMany).not.toHaveBeenCalled();
  });
});

describe("JobRunService.record — admin alerts", () => {
  const fail = () => {
    throw new Error("boom");
  };

  it("alerts on the first failure after a success", async () => {
    const { service, alerts } = makeService("SUCCESS");

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => fail(),
        () => "",
      ),
    ).rejects.toThrow("boom");

    expect(alerts.jobFailed).toHaveBeenCalledWith(
      JOB_KEYS.BACKUP,
      expect.objectContaining({ message: "boom" }),
    );
  });

  it("alerts when a job's very first run fails", async () => {
    const { service, alerts } = makeService();

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => fail(),
        () => "",
      ),
    ).rejects.toThrow("boom");

    expect(alerts.jobFailed).toHaveBeenCalledOnce();
  });

  it("stays silent while a job keeps failing", async () => {
    const { service, alerts } = makeService("FAILURE");

    await expect(
      service.record(
        JOB_KEYS.BACKUP,
        async () => fail(),
        () => "",
      ),
    ).rejects.toThrow("boom");

    expect(alerts.jobFailed).not.toHaveBeenCalled();
  });

  it("announces the recovery on the first success after a failure", async () => {
    const { service, alerts } = makeService("FAILURE");

    await service.record(
      JOB_KEYS.BACKUP,
      async () => "ok",
      () => "",
    );

    expect(alerts.jobRecovered).toHaveBeenCalledWith(JOB_KEYS.BACKUP);
  });

  it("stays silent while a job keeps succeeding", async () => {
    const { service, alerts } = makeService("SUCCESS");

    await service.record(
      JOB_KEYS.BACKUP,
      async () => "ok",
      () => "",
    );

    expect(alerts.jobRecovered).not.toHaveBeenCalled();
    expect(alerts.jobFailed).not.toHaveBeenCalled();
  });
});
