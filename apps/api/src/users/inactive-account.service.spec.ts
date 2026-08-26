import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AccountDeletionService } from "./account-deletion.service";
import { InactiveAccountService } from "./inactive-account.service";

function makeService() {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const mail = {
    sendInactivityWarning: jest.fn(),
  } as unknown as MailService;
  const accountDeletion = {
    deleteAccount: jest.fn(),
  } as unknown as AccountDeletionService;
  // Runs the job body directly, bypassing JobRun persistence/Healthchecks —
  // those are covered by JobRunService's own tests.
  const jobRuns = {
    record: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as JobRunService;

  const service = new InactiveAccountService(
    prisma,
    mail,
    accountDeletion,
    jobRuns,
  );
  return { service, prisma, mail, accountDeletion };
}

describe("InactiveAccountService.scan", () => {
  it("sends the reminder to accounts inactive for 24+ months with no warning yet", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "user-1",
          email: "alice@example.com",
          lastActiveAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.scan();

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        lastActiveAt: { lte: expect.any(Date) },
        inactivityWarningSentAt: null,
      },
      select: { id: true, email: true, lastActiveAt: true },
    });
    expect(mail.sendInactivityWarning).toHaveBeenCalledWith(
      "alice@example.com",
      "01/01/2027",
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { inactivityWarningSentAt: expect.any(Date) },
    });
    expect(result).toEqual({ warned: 1, deleted: 0 });
  });

  it("deletes accounts inactive for 36+ months that were already warned", async () => {
    const { service, prisma, accountDeletion } = makeService();
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // no new warnings to send
      .mockResolvedValueOnce([{ id: "user-2" }]);

    const result = await service.scan();

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        lastActiveAt: { lte: expect.any(Date) },
        inactivityWarningSentAt: { not: null },
      },
      select: { id: true },
    });
    expect(accountDeletion.deleteAccount).toHaveBeenCalledWith(
      "user-2",
      expect.stringContaining("LK-C06"),
    );
    expect(result).toEqual({ warned: 0, deleted: 1 });
  });

  it("does nothing when no account crosses either threshold", async () => {
    const { service, mail, accountDeletion } = makeService();

    const result = await service.scan();

    expect(mail.sendInactivityWarning).not.toHaveBeenCalled();
    expect(accountDeletion.deleteAccount).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, deleted: 0 });
  });
});
