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
  locale: "en",
  timezone: "Europe/Paris",
};

const pendingRow = {
  id: "n1",
  title: "Severance",
  body: "S2E5 · The One With The Finale",
  url: "/app/media/series/42",
  dedupeKey: "episode:ep1",
};

function makeService(opts: {
  notifyEmail?: DigestCadence;
  notifyPush?: DigestCadence;
  pending?: (typeof pendingRow)[];
  isPremium?: boolean;
  /** Episode ids whose show the user muted alerts for. */
  mutedEpisodeIds?: string[];
  activeMovieIds?: string[];
}) {
  const {
    notifyEmail = DigestCadence.WEEKLY,
    notifyPush = DigestCadence.DISABLED,
    pending = [pendingRow],
    isPremium = false,
    mutedEpisodeIds = [],
    activeMovieIds = [],
  } = opts;

  const prisma = {
    libraryEntry: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          activeMovieIds.map((mediaItemId) => ({ mediaItemId })),
        ),
    },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ ...user, notifyEmail, notifyPush }]),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue(pending),
      updateMany: vi.fn().mockResolvedValue({ count: pending.length }),
    },
    episode: {
      findMany: vi
        .fn()
        .mockResolvedValue(mutedEpisodeIds.map((id) => ({ id }))),
    },
  } as unknown as PrismaService;
  const push = {
    sendToUserDetailed: vi
      .fn()
      .mockResolvedValue([{ userAgent: "Chrome", ok: true }]),
  } as unknown as PushService;
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
  afterEach(() => vi.useRealTimers());
  it("includes movie reminders in the same weekly email summary", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-24T07:00:00Z"));
    const movie = {
      ...pendingRow,
      id: "movie-n",
      title: "Future movie",
      body: "Cinema release · FR",
      dedupeKey: "movie:m1",
      url: "/app/media/movie/1",
    };
    const { service, mail } = makeService({
      pending: [pendingRow, movie],
      activeMovieIds: ["m1"],
    });
    expect(await service.runDigests()).toBe(1);
    expect(mail.sendEpisodeDigest).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({ title: "Severance" }),
        expect.objectContaining({ title: "Future movie" }),
      ],
      "weekly",
    );
  });
  it("does not deliver a movie reminder cancelled before the summary", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-24T07:00:00Z"));
    const { service, mail, prisma } = makeService({
      pending: [{ ...pendingRow, dedupeKey: "movie:m1" }],
    });
    expect(await service.runDigests()).toBe(0);
    expect(mail.sendEpisodeDigest).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });
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
      { email: "alice@example.com", locale: "en" },
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
    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        title: "Loomkeep",
        url: "/app/media/series/42",
      }),
    );

    vi.useRealTimers();
  });

  it("writes the push digest in the recipient's language", async () => {
    const day18hParis = new Date("2026-08-25T16:00:00.000Z");
    vi.useFakeTimers().setSystemTime(day18hParis);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { service, push } = makeService({
      notifyPush: DigestCadence.DAILY,
      isPremium: true,
    });
    await service.runDigests();

    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ body: "New episode of Severance, out today." }),
    );

    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("names each show once and speaks of the past week on Monday", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { service, push } = makeService({
      notifyEmail: DigestCadence.DISABLED,
      notifyPush: DigestCadence.WEEKLY,
      pending: [
        pendingRow,
        { ...pendingRow, id: "n2", dedupeKey: "episode:ep2" },
      ],
    });
    await service.runDigests();

    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        body: "2 new episodes of Severance, out in the last 7 days.",
      }),
    );

    vi.restoreAllMocks();
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
      { email: "alice@example.com", locale: "en" },
      expect.any(Array),
      "weekly",
    );

    vi.useRealTimers();
  });

  it("leaves muted shows out of the digest but still marks them digested", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const mutedRow = {
      id: "n2",
      title: "Lanterns",
      body: "S1E7",
      url: "/app/media/series/7",
      dedupeKey: "episode:ep2",
    };
    const { service, mail, prisma } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
      pending: [pendingRow, mutedRow],
      mutedEpisodeIds: ["ep2"],
    });
    const sent = await service.runDigests();

    expect(sent).toBe(1);
    expect(mail.sendEpisodeDigest).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ title: "Severance" })],
      "weekly",
    );
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1", "n2"] } },
      data: { emailDigestedAt: monday9amParis },
    });

    vi.useRealTimers();
  });

  it("sends nothing when every pending row belongs to a muted show", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, mail, prisma } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
      mutedEpisodeIds: ["ep1"],
    });
    const sent = await service.runDigests();

    expect(sent).toBe(0);
    expect(mail.sendEpisodeDigest).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["n1"] } },
      data: { emailDigestedAt: monday9amParis },
    });

    vi.useRealTimers();
  });

  it("still pushes the digest when its email fails", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, mail, push } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
      notifyPush: DigestCadence.WEEKLY,
    });
    (mail.sendEpisodeDigest as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("SMTP unavailable"),
    );

    await expect(service.runDigests()).resolves.toBe(1);
    expect(push.sendToUserDetailed).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("keeps the rows pending when no device received the push digest", async () => {
    const day18hParis = new Date("2026-08-25T16:00:00.000Z");
    vi.useFakeTimers().setSystemTime(day18hParis);

    const { service, push, prisma } = makeService({
      notifyEmail: DigestCadence.DISABLED,
      notifyPush: DigestCadence.DAILY,
      isPremium: true,
    });
    (push.sendToUserDetailed as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userAgent: "Chrome", ok: false, error: "HTTP 500" },
    ]);

    await expect(service.runDigests()).resolves.toBe(0);
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("leaves out episodes of shows dropped or no longer in the library", async () => {
    const monday9amParis = new Date("2026-08-24T07:00:00.000Z");
    vi.useFakeTimers().setSystemTime(monday9amParis);

    const { service, prisma } = makeService({
      notifyEmail: DigestCadence.WEEKLY,
    });
    await service.runDigests();

    const [[query]] = (prisma.episode.findMany as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(query.where.season.mediaItem).toEqual({
      OR: [
        {
          entries: {
            some: {
              userId: "u1",
              OR: [{ episodeAlertsMuted: true }, { status: "DROPPED" }],
            },
          },
        },
        { entries: { none: { userId: "u1" } } },
      ],
    });

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
          type: {
            in: [
              NotificationType.NEW_EPISODE,
              NotificationType.NEW_MOVIE,
              NotificationType.NEW_GAME,
            ],
          },
          emailDigestedAt: null,
        }),
      }),
    );

    vi.useRealTimers();
  });
});
