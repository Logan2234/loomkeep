import type { PrismaService } from "../prisma/prisma.service";
import { JOB_KEYS } from "./job-keys";
import { JobRunService } from "./job-run.service";

function makeService() {
  const prisma = {
    jobRun: {
      create: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue(undefined),
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
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(undefined);
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
