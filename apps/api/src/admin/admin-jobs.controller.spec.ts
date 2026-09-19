import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import { JOB_KEYS } from "../jobs/job-keys";
import { AdminJobsController } from "./admin-jobs.controller";

function makeController() {
  const scanAll = vi.fn().mockResolvedValue(undefined);
  const controller = new AdminJobsController(
    {} as never,
    { scanAll } as never,
    { runDigests: vi.fn() } as never,
    { refreshStale: vi.fn() } as never,
    { sendDailyDigest: vi.fn() } as never,
    { runScheduled: vi.fn() } as never,
    { scan: vi.fn() } as never,
    { runReconcileJob: vi.fn() } as never,
    { runAchievementsSweepJob: vi.fn() } as never,
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
});
