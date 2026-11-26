import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { JOB_KEYS } from "./job-keys";
import { JobLockService } from "./job-lock.service";

function makeService(locked: boolean) {
  const queryRaw = vi.fn().mockResolvedValue([{ locked }]);
  const prisma = {
    $transaction: vi.fn(
      async (fn: (tx: unknown) => Promise<unknown>, _options: unknown) =>
        fn({ $queryRaw: queryRaw }),
    ),
  };
  return {
    service: new JobLockService(prisma as unknown as PrismaService),
    prisma,
    queryRaw,
  };
}

describe("JobLockService.runExclusive", () => {
  it("runs the job when it gets the lock", async () => {
    const { service } = makeService(true);

    await expect(
      service.runExclusive(JOB_KEYS.BACKUP, async () => "done"),
    ).resolves.toEqual({ ran: true, value: "done" });
  });

  it("leaves the job alone when another process holds it", async () => {
    const { service } = makeService(false);
    const job = vi.fn();

    await expect(service.runExclusive(JOB_KEYS.BACKUP, job)).resolves.toEqual({
      ran: false,
    });
    expect(job).not.toHaveBeenCalled();
  });

  it("locks on the job's own key", async () => {
    const { service, queryRaw } = makeService(true);

    await service.runExclusive(JOB_KEYS.BACKUP, async () => undefined);

    expect(queryRaw.mock.calls[0]).toContain(JOB_KEYS.BACKUP);
  });

  it("lets a failing job's error through, which ends the transaction and its lock", async () => {
    const { service } = makeService(true);

    await expect(
      service.runExclusive(JOB_KEYS.BACKUP, async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });
});
