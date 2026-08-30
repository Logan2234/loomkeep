import { DigestCadence, NotificationType } from "@loomkeep/shared";
import { vi } from "vitest";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NotificationDigestService } from "./notification-digest.service";
import type { PushService } from "./push.service";

const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

const user = {
  id: "u1",
  email: "alice@example.com",
  timezone: "Europe/Paris",
};

const pendingRow = {
  id: "n1",
  title: "Severance",
  body: "S2E5 · The One With The Finale",
  url: "/app/media/series/42",
};

function makeService(opts: {
  notifyEmail?: DigestCadence;
  notifyPush?: DigestCadence;
  pending?: (typeof pendingRow)[];
  isPremium?: boolean;
}) {
  const {
    notifyEmail = DigestCadence.WEEKLY,
    notifyPush = DigestCadence.DISABLED,
    pending = [pendingRow],
    isPremium = false,
  } = opts;

  const prisma = {
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ ...user, notifyEmail, notifyPush }]),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue(pending),
      updateMany: vi.fn().mockResolvedValue({ count: pending.length }),
    },
  } as unknown as PrismaService;
  const push = { sendToUser: vi.fn() } as unknown as PushService;
  const mail = { sendEpisodeDigest: vi.fn() } as unknown as MailService;
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(isPremium),
  } as unknown as EntitlementService;

  const service = new NotificationDigestService(
    prisma,
    push,
    mail,
    entitlements,
    jobRunsStub,
  );
  return { service, prisma, push, mail, entitlements };
}

describe("NotificationDigestService.resolveEffectiveCadence", () => {
  it("keeps WEEKLY/DISABLED as-is regardless of premium", async () => {
    const { service } = makeService({ isPremium: false });
    expect(
      await service.resolveEffectiveCadence(DigestCadence.WEEKLY, "u1"),
    ).toBe(DigestCadence.WEEKLY);
    expect(
      await service.resolveEffectiveCadence(DigestCadence.DISABLED, "u1"),
    ).toBe(DigestCadence.DISABLED);
  });

  it("keeps DAILY when the user is effectively premium", async () => {
    const { service } = makeService({ isPremium: true });
    expect(
      await service.resolveEffectiveCadence(DigestCadence.DAILY, "u1"),
    ).toBe(DigestCadence.DAILY);
  });

  it("caps DAILY down to WEEKLY when not effectively premium", async () => {
    const { service } = makeService({ isPremium: false });
    expect(
      await service.resolveEffectiveCadence(DigestCadence.DAILY, "u1"),
    ).toBe(DigestCadence.WEEKLY);
  });
});

describe("NotificationDigestService.runDigests", () => {
  it("sends the weekly email digest on Monday 9h local and marks rows digested", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, mail, prisma } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
    });
    const sent = await service.runDigests();

    expect(sent).toBe(1);
    expect(mail.sendEpisodeDigest).toHaveBeenCalledWith(
      "alice@example.com",
      [
        {
          title: "Severance",
          body: "S2E5 · The One With The Finale",
          url: "/app/media/series/42",
        },
      ],
      "weekly",
    );
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1"] } },
      data: { emailDigestedAt: monday9amParis },
    });

    vi.useRealTimers();
  });

  it("sends the daily push digest at 18h local for a premium user", async () => {
    const day18hParis = new Date("2026-08-25T16:00:00.000Z");
    vi.useFakeTimers().setSystemTime(day18hParis);

    const { service, push } = makeService({
      notifyPush: DigestCadence.DAILY,
      isPremium: true,
    });
    const sent = await service.runDigests();

    expect(sent).toBe(1);
    expect(push.sendToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        title: "Loomkeep",
        url: "/app/media/series/42",
      }),
    );

    vi.useRealTimers();
  });

  it("does not send outside the due window", async () => {
    const noon = new Date("2026-08-24T10:00:00.000Z");
    vi.useFakeTimers().setSystemTime(noon);

    const { service, mail } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
    });
    const sent = await service.runDigests();

    expect(sent).toBe(0);
    expect(mail.sendEpisodeDigest).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("does not send when nothing is pending", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, mail } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
      pending: [],
    });
    const sent = await service.runDigests();

    expect(sent).toBe(0);
    expect(mail.sendEpisodeDigest).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("caps a non-premium DAILY email preference to WEEKLY's send window", async () => {
    const day18hParis = new Date("2026-08-25T16:00:00.000Z");
    vi.useFakeTimers().setSystemTime(day18hParis);

    const { service: notDueService, mail: notDueMail } = makeService({
      notifyEmail: DigestCadence.DAILY,
      isPremium: false,
    });
    expect(await notDueService.runDigests()).toBe(0);
    expect(notDueMail.sendEpisodeDigest).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-08-24T07:00:00.000Z"));
    const { service: dueService, mail: dueMail } = makeService({
      notifyEmail: DigestCadence.DAILY,
      isPremium: false,
    });
    expect(await dueService.runDigests()).toBe(1);
    expect(dueMail.sendEpisodeDigest).toHaveBeenCalledWith(
      "alice@example.com",
      expect.any(Array),
      "weekly",
    );

    vi.useRealTimers();
  });

  it("queries only rows not yet digested on the sending channel", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, prisma } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
    });
    await service.runDigests();

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          type: NotificationType.NEW_EPISODE,
          emailDigestedAt: null,
        }),
      }),
    );

    vi.useRealTimers();
  });
});
