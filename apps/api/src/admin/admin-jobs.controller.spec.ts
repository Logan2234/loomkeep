import { ErrorCode } from "@loomkeep/shared/catalog";
import { vi } from "vitest";
import { JOB_KEYS } from "../jobs/job-keys";
import { JOB_SKIPPED } from "../jobs/job-run.service";
import { AdminJobsController } from "./admin-jobs.controller";

function makeController() {
  const scanAll = vi.fn().mockResolvedValue(undefined);
  const controller = new AdminJobsController(
    {} as never,
    { scanAll } as never,
    { runDigests: vi.fn() } as never,
    { refreshStale: vi.fn() } as never,
    { refreshStale: vi.fn() } as never,
    { refreshStale: vi.fn() } as never,
    { sendDailyDigest: vi.fn() } as never,
    { runScheduled: vi.fn() } as never,
    { scan: vi.fn() } as never,
    { runReconcileJob: vi.fn() } as never,
    { runAchievementsSweepJob: vi.fn() } as never,
    { runMaintenance: vi.fn() } as never,
    { runScheduled: vi.fn() } as never,
    { scan: vi.fn() } as never,
    { runReminders: vi.fn() } as never,
    { runPurgeJob: vi.fn() } as never,
    { runPurgeJob: vi.fn() } as never,
  );
  return { controller, scanAll };
}

describe("AdminJobsController.runJob", () => {
  it.each(["unknown-job", "constructor"])(
    "rejects %s without dispatching a job",
    async (key) => {
      const { controller, scanAll } = makeController();

      await expect(controller.runJob(key)).rejects.toMatchObject({
        response: ErrorCode.AdminUnknownJob,
      });
      expect(scanAll).not.toHaveBeenCalled();
    },
  );

  it("dispatches a registered job", async () => {
    const { controller, scanAll } = makeController();

    await controller.runJob(JOB_KEYS.NOTIFICATIONS_SCAN);

    expect(scanAll).toHaveBeenCalledOnce();
  });

  it("answers a conflict when the job is already running elsewhere", async () => {
    const { controller, scanAll } = makeController();
    scanAll.mockResolvedValue(JOB_SKIPPED);

    await expect(
      controller.runJob(JOB_KEYS.NOTIFICATIONS_SCAN),
    ).rejects.toMatchObject({ response: ErrorCode.AdminJobAlreadyRunning });
  });
});
