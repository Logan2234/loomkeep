import { ACCOUNT_DELETION_GRACE_DAYS, ErrorCode } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import { sha256Hex } from "../common/crypto.util";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AccountDeletionService } from "./account-deletion.service";
import { ScheduledDeletionService } from "./scheduled-deletion.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALICE = { email: "alice@example.com", locale: "fr" };

function make(user: Record<string, unknown> | null = { ...ALICE }) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const mail = {
    sendAccountDeletionScheduled: vi.fn(),
    sendAccountDeletionReminder: vi.fn(),
    sendAccountDeletionCancelled: vi.fn(),
  } as unknown as MailService;
  const accountDeletion = {
    deleteAccount: vi.fn(),
  } as unknown as AccountDeletionService;
  const jobRuns = {
    record: vi.fn((_key, fn: () => Promise<unknown>) => fn()),
  } as unknown as JobRunService;
  const service = new ScheduledDeletionService(
    prisma,
    mail,
    accountDeletion,
    jobRuns,
  );
  return { service, prisma, mail, accountDeletion };
}

describe("ScheduledDeletionService.schedule", () => {
  it("sets the date 14 days out and mails a cancel link matching the stored hash", async () => {
    const { service, prisma, mail } = make();

    const { scheduledFor } = await service.schedule("user-1", "PRIVACY");

    const days = (new Date(scheduledFor).getTime() - Date.now()) / DAY_MS;
    expect(Math.round(days)).toBe(ACCOUNT_DELETION_GRACE_DAYS);
    const [[{ data }]] = (prisma.user.update as Mock).mock.calls;
    expect(data.deletionReason).toBe("PRIVACY");
    const [[recipient, date, token]] = (
      mail.sendAccountDeletionScheduled as Mock
    ).mock.calls;
    expect(recipient).toEqual(ALICE);
    expect(date.toISOString()).toBe(scheduledFor);
    expect(data.deletionCancelTokenHash).toBe(sha256Hex(token));
  });

  it("keeps the first date when asked again", async () => {
    const first = new Date("2026-11-03T05:15:00Z");
    const { service, prisma, mail } = make({
      ...ALICE,
      deletionScheduledFor: first,
    });

    await expect(service.schedule("user-1")).resolves.toEqual({
      scheduledFor: first.toISOString(),
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mail.sendAccountDeletionScheduled).not.toHaveBeenCalled();
  });
});

describe("ScheduledDeletionService cancellation", () => {
  it("refuses a link that matches no scheduled deletion", async () => {
    const { service, prisma } = make();
    (prisma.user.updateMany as Mock).mockResolvedValue({ count: 0 });

    await expect(service.cancelWithToken("bogus")).rejects.toMatchObject({
      code: ErrorCode.UserDeletionCancelLinkInvalid,
    });
  });

  it("clears the date, the reason and the link from the token's hash", async () => {
    const { service, prisma } = make();

    await service.cancelWithToken("the-token");

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        deletionCancelTokenHash: sha256Hex("the-token"),
        deletionScheduledFor: { not: null },
      },
      data: {
        deletionScheduledFor: null,
        deletionReason: null,
        deletionCancelTokenHash: null,
      },
    });
  });

  it("tells the person when an administrator cancelled it", async () => {
    const { service, mail } = make({
      ...ALICE,
      deletionScheduledFor: new Date("2026-11-03T05:15:00Z"),
    });

    await service.cancelByAdmin("user-1");

    expect(mail.sendAccountDeletionCancelled).toHaveBeenCalledWith(ALICE);
  });

  it("lets an administrator know there was nothing to cancel", async () => {
    const { service } = make({ ...ALICE, deletionScheduledFor: null });

    await expect(service.cancelByAdmin("user-1")).rejects.toMatchObject({
      code: ErrorCode.UserDeletionNotScheduled,
    });
  });
});

describe("ScheduledDeletionService.scan", () => {
  it("reminds the accounts due in 24 to 48 hours and deletes the overdue ones", async () => {
    const { service, prisma, mail, accountDeletion } = make();
    const due = new Date(Date.now() + 36 * 60 * 60 * 1000);
    (prisma.user.findMany as Mock)
      .mockResolvedValueOnce([{ ...ALICE, deletionScheduledFor: due }])
      .mockResolvedValueOnce([{ id: "user-2" }]);

    await expect(service.scan()).resolves.toEqual({ reminded: 1, deleted: 1 });

    const [[reminderQuery], [dueQuery]] = (prisma.user.findMany as Mock).mock
      .calls;
    const window = reminderQuery.where.deletionScheduledFor;
    expect(
      Math.round((window.gt.getTime() - Date.now()) / (60 * 60 * 1000)),
    ).toBe(24);
    expect(
      Math.round((window.lte.getTime() - Date.now()) / (60 * 60 * 1000)),
    ).toBe(48);
    expect(dueQuery.where.deletionScheduledFor.lte).toBeInstanceOf(Date);
    expect(mail.sendAccountDeletionReminder).toHaveBeenCalledWith(ALICE, due);
    expect(accountDeletion.deleteAccount).toHaveBeenCalledWith(
      "user-2",
      "self",
      expect.any(String),
    );
  });
});
