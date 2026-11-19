import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AccountDeletionService } from "./account-deletion.service";
import { InactiveAccountService } from "./inactive-account.service";

function makeService() {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  } as unknown as PrismaService;
  const mail = {
    sendInactivityWarning: vi.fn().mockResolvedValue(true),
  } as unknown as MailService;
  const accountDeletion = {
    deleteAccount: vi.fn(),
  } as unknown as AccountDeletionService;
  // Runs the job body directly, bypassing JobRun persistence/Healthchecks —
  // those are covered by JobRunService's own tests.
  const jobRuns = {
    record: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
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
    (prisma.user.findMany as Mock)
      .mockResolvedValueOnce([
        {
          id: "user-1",
          email: "alice@example.com",
          locale: "en",
          lastActiveAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.scan();

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        lastActiveAt: { lte: expect.any(Date) },
        inactivityWarningSentAt: null,
        OR: [
          { suspendedUntil: null },
          { suspendedUntil: { lte: expect.any(Date) } },
        ],
      },
      select: { id: true, email: true, locale: true, lastActiveAt: true },
    });
    expect(mail.sendInactivityWarning).toHaveBeenCalledWith(
      { email: "alice@example.com", locale: "en" },
      new Date("2027-01-01T00:00:00.000Z"),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { inactivityWarningSentAt: expect.any(Date) },
    });
    expect(result).toEqual({ warned: 1, deleted: 0 });
  });

  it("doesn't mark an account as warned when the email didn't go out", async () => {
    const { service, prisma, mail } = makeService();
    (mail.sendInactivityWarning as Mock).mockResolvedValue(false);
    (prisma.user.findMany as Mock)
      .mockResolvedValueOnce([
        {
          id: "user-1",
          email: "alice@example.com",
          locale: "en",
          lastActiveAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.scan();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, deleted: 0 });
  });

  it("deletes accounts inactive for 36+ months that were warned at least 30 days ago", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findMany as Mock)
      .mockResolvedValueOnce([]) // no new warnings to send
      .mockResolvedValueOnce([{ id: "user-2" }]);

    const result = await service.scan();

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        lastActiveAt: { lte: expect.any(Date) },
        inactivityWarningSentAt: { lte: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(result).toEqual({ warned: 0, deleted: 1 });
  });

  it("gives a full notice to an account already past 36 months when it is first warned", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.user.findMany as Mock)
      .mockResolvedValueOnce([
        {
          id: "user-3",
          email: "carol@example.com",
          locale: "fr",
          lastActiveAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);
    const before = Date.now();

    await service.scan();

    const [, announcedDeletion] = (mail.sendInactivityWarning as Mock).mock
      .calls[0] as [unknown, Date];
    expect(announcedDeletion.getTime()).toBeGreaterThanOrEqual(
      before + 30 * 24 * 60 * 60 * 1000,
    );
    const deletionQuery = (prisma.user.findMany as Mock).mock.calls[1][0] as {
      where: { inactivityWarningSentAt: { lte: Date } };
    };
    expect(
      deletionQuery.where.inactivityWarningSentAt.lte.getTime(),
    ).toBeLessThanOrEqual(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });

  it("does nothing when no account crosses either threshold", async () => {
    const { service, mail, accountDeletion } = makeService();

    const result = await service.scan();

    expect(mail.sendInactivityWarning).not.toHaveBeenCalled();
    expect(accountDeletion.deleteAccount).not.toHaveBeenCalled();
    expect(result).toEqual({ warned: 0, deleted: 0 });
  });
});
