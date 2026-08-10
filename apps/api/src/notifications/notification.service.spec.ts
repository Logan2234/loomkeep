import { NotFoundException } from "@nestjs/common";
import { NotificationType } from "@loomkeep/shared";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";
import type { PushService } from "./push.service";

// Runs `fn` straight through without touching the DB, for services under test
// that don't exercise job-recording behaviour themselves.
const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

describe("NotificationService.scanAll", () => {
  function makeService(userIds: string[]) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(userIds.map((id) => ({ id }))),
      },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn() } as never;
    const mail = { sendNewEpisode: jest.fn() } as never;
    const service = new NotificationService(prisma, push, mail, jobRunsStub);
    return { service, prisma };
  }

  it("only queries users with push or email notifications enabled", async () => {
    const { service, prisma } = makeService([]);
    await service.scanAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ notifyPush: true }, { notifyEmail: true }] },
      select: { id: true },
    });
  });

  it("scans every eligible user and sums the created count", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const created = await service.scanAll();

    expect(created).toBe(3);
    expect(scan).toHaveBeenCalledTimes(3);
    expect(scan).toHaveBeenNthCalledWith(1, "u1");
    expect(scan).toHaveBeenNthCalledWith(2, "u2");
    expect(scan).toHaveBeenNthCalledWith(3, "u3");
  });

  it("keeps scanning the rest of the batch when one user fails", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(4);

    const created = await service.scanAll();

    expect(created).toBe(5);
    expect(scan).toHaveBeenCalledTimes(3);
  });
});

describe("NotificationService.scan (push)", () => {
  const episode = {
    id: "ep1",
    number: 5,
    title: "The One With The Finale",
    airDate: new Date(),
    season: {
      number: 2,
      mediaItem: {
        title: "Severance",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "42" }],
        entries: [{ createdAt: new Date(0) }],
      },
    },
  };

  function makeService(
    notifyPush: boolean,
    enabledDomains: string[] = ["MEDIA", "BOOKS", "GAMES"],
    notifyEmail = false,
  ) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: "alice@example.com",
          notifyPush,
          notifyEmail,
          enabledDomains,
        }),
      },
      episode: { findMany: jest.fn().mockResolvedValue([episode]) },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const push = { sendToUser: jest.fn() } as unknown as PushService;
    const mail = { sendNewEpisode: jest.fn() } as unknown as MailService;
    const service = new NotificationService(prisma, push, mail, jobRunsStub);
    return { service, push, mail, prisma };
  }

  it("sends a push per new notification when notifyPush is enabled", async () => {
    const { service, push } = makeService(true);
    await service.scan("u1");
    expect(push.sendToUser).toHaveBeenCalledWith("u1", {
      title: "Severance",
      body: "S2E5 · The One With The Finale",
      url: "/app/media/series/42",
    });
  });

  it("skips push entirely when notifyPush is disabled", async () => {
    const { service, push } = makeService(false);
    await service.scan("u1");
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it("sends an email per new notification when notifyEmail is enabled", async () => {
    const { service, mail } = makeService(false, undefined, true);
    await service.scan("u1");
    expect(mail.sendNewEpisode).toHaveBeenCalledWith(
      "alice@example.com",
      "Severance",
      "S2E5 · The One With The Finale",
      "/app/media/series/42",
    );
  });

  it("skips email entirely when notifyEmail is disabled", async () => {
    const { service, mail } = makeService(true, undefined, false);
    await service.scan("u1");
    expect(mail.sendNewEpisode).not.toHaveBeenCalled();
  });

  it("creates no episode notifications when both push and email are disabled", async () => {
    const { service, prisma } = makeService(false, undefined, false);
    const created = await service.scan("u1");
    expect(created).toBe(0);
    expect(prisma.episode.findMany).not.toHaveBeenCalled();
  });

  it("creates no episode notifications when the MEDIA domain is disabled", async () => {
    const { service, push, prisma } = makeService(true, ["BOOKS", "GAMES"]);
    const created = await service.scan("u1");
    expect(created).toBe(0);
    // Filtered before any episode lookup or push.
    expect(prisma.episode.findMany).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});

describe("NotificationService — bell feed (read = deleted)", () => {
  function makeService() {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(
      prisma,
      {} as never,
      {} as never,
      jobRunsStub,
    );
    return { service, prisma };
  }

  it("excludes NEW_EPISODE and FOLLOW_REQUEST from the feed", async () => {
    const { service, prisma } = makeService();
    await service.feed("u1");
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          type: {
            notIn: [
              NotificationType.NEW_EPISODE,
              NotificationType.FOLLOW_REQUEST,
            ],
          },
        },
      }),
    );
  });

  it("reports every returned row as unread (existence = unread)", async () => {
    const { service, prisma } = makeService();
    (prisma.notification.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "n1",
        type: "FOLLOW",
        title: "Alice",
        data: {},
        createdAt: new Date(),
      },
      {
        id: "n2",
        type: "FOLLOW",
        title: "Bob",
        data: {},
        createdAt: new Date(),
      },
    ]);
    const feed = await service.feed("u1");
    expect(feed.unread).toBe(2);
    expect(feed.notifications).toHaveLength(2);
  });

  it("markRead deletes the row", async () => {
    const { service, prisma } = makeService();
    await service.markRead("u1", "n1");
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
    });
  });

  it("markRead throws when nothing was deleted", async () => {
    const { service, prisma } = makeService();
    (prisma.notification.deleteMany as jest.Mock).mockResolvedValueOnce({
      count: 0,
    });
    await expect(service.markRead("u1", "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("markAllRead deletes every bell-visible row for the user", async () => {
    const { service, prisma } = makeService();
    await service.markAllRead("u1");
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        type: {
          notIn: [
            NotificationType.NEW_EPISODE,
            NotificationType.FOLLOW_REQUEST,
          ],
        },
      },
    });
  });
});
