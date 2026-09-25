import { DigestCadence, NotificationType } from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
import type { EventsGateway } from "../events/events.gateway";
import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";

// Runs `fn` straight through without touching the DB, for services under test
// that don't exercise job-recording behaviour themselves.
const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

const eventsStub = { emitToUser: vi.fn() } as unknown as EventsGateway;

describe("NotificationService.scanAll", () => {
  const AIRED = new Date();
  const TRACKED_SINCE = new Date(AIRED.getTime() - 30 * 86_400_000);

  function episodeRow(over: Record<string, unknown> = {}) {
    return {
      id: "ep1",
      number: 5,
      title: "Le dénouement",
      airDate: AIRED,
      season: {
        number: 2,
        mediaItemId: "m1",
        mediaItem: {
          title: "Une série",
          type: "SERIES",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "42" }],
        },
      },
      ...over,
    };
  }

  function makeService(over: {
    episodes?: unknown[];
    entries?: unknown[];
    existing?: unknown[];
  }) {
    const prisma = {
      episode: {
        findMany: vi.fn().mockResolvedValue(over.episodes ?? [episodeRow()]),
      },
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            over.entries ?? [
              { userId: "u1", mediaItemId: "m1", createdAt: TRACKED_SINCE },
            ],
          ),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue(over.existing ?? []),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(prisma, jobRunsStub, eventsStub);
    return { service, prisma };
  }

  it("starts from the episodes, which do not grow with the user count", async () => {
    // The hourly sweep must not run one joined query per subscribed account.
    const { service, prisma } = makeService({});

    await service.scanAll();

    const where = (prisma.episode.findMany as Mock).mock.calls[0][0].where;
    expect(where.season).toEqual({ number: { gt: 0 } });
    expect(where.airDate.gt).toBeInstanceOf(Date);
    expect(where.airDate.lte).toBeInstanceOf(Date);
  });

  it("stops after one query when nothing aired in the window", async () => {
    const { service, prisma } = makeService({ episodes: [] });

    const created = await service.scanAll();

    expect(created).toBe(0);
    expect(prisma.libraryEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("applies the digest and domain gates in the entry query", async () => {
    const { service, prisma } = makeService({});

    await service.scanAll();

    const where = (prisma.libraryEntry.findMany as Mock).mock.calls[0][0].where;
    expect(where.status).toEqual({ not: "DROPPED" });
    expect(where.user.enabledDomains).toEqual({ has: "MEDIA" });
    expect(where.user.OR).toEqual([
      { notifyPush: { not: DigestCadence.DISABLED } },
      { notifyEmail: { not: DigestCadence.DISABLED } },
    ]);
  });

  it("creates one row per tracking user in a single write", async () => {
    const { service, prisma } = makeService({
      entries: [
        { userId: "u1", mediaItemId: "m1", createdAt: TRACKED_SINCE },
        { userId: "u2", mediaItemId: "m1", createdAt: TRACKED_SINCE },
      ],
    });

    const created = await service.scanAll();

    expect(created).toBe(2);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const rows = (prisma.notification.createMany as Mock).mock.calls[0][0].data;
    expect(rows.map((r: { userId: string }) => r.userId)).toEqual(["u1", "u2"]);
    expect(rows[0]).toMatchObject({
      type: NotificationType.NEW_EPISODE,
      title: "Une série",
      body: "S2E5 · Le dénouement",
      dedupeKey: "episode:ep1",
    });
  });

  it("skips a user already notified without skipping the others", async () => {
    // Dedup is per (user, episode): one user having seen it must not suppress
    // the row for everyone else tracking the same show.
    const { service, prisma } = makeService({
      entries: [
        { userId: "u1", mediaItemId: "m1", createdAt: TRACKED_SINCE },
        { userId: "u2", mediaItemId: "m1", createdAt: TRACKED_SINCE },
      ],
      existing: [{ userId: "u1", dedupeKey: "episode:ep1" }],
    });

    const created = await service.scanAll();

    expect(created).toBe(1);
    const rows = (prisma.notification.createMany as Mock).mock.calls[0][0].data;
    expect(rows[0].userId).toBe("u2");
  });

  it("never notifies an episode that aired before the user started tracking", async () => {
    const { service, prisma } = makeService({
      entries: [
        {
          userId: "u1",
          mediaItemId: "m1",
          createdAt: new Date(Date.now() + 1000),
        },
      ],
    });

    const created = await service.scanAll();

    expect(created).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("NotificationService.scan", () => {
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
    notifyPush: DigestCadence,
    enabledDomains: string[] = ["MEDIA", "BOOKS", "GAMES"],
    notifyEmail: DigestCadence = DigestCadence.DISABLED,
  ) {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          notifyPush,
          notifyEmail,
          enabledDomains,
        }),
      },
      episode: { findMany: vi.fn().mockResolvedValue([episode]) },
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(prisma, jobRunsStub, eventsStub);
    return { service, prisma };
  }

  it("creates a ledger row per new episode when a channel is enabled", async () => {
    const { service, prisma } = makeService(DigestCadence.DAILY);
    const created = await service.scan("u1");
    expect(created).toBe(1);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "u1",
          type: NotificationType.NEW_EPISODE,
          title: "Severance",
          body: "S2E5 · The One With The Finale",
          url: "/app/media/series/42",
          dedupeKey: "episode:ep1",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("creates no episode notifications when both channels are disabled", async () => {
    const { service, prisma } = makeService(DigestCadence.DISABLED);
    const created = await service.scan("u1");
    expect(created).toBe(0);
    expect(prisma.episode.findMany).not.toHaveBeenCalled();
  });

  it("creates no episode notifications when the MEDIA domain is disabled", async () => {
    const { service, prisma } = makeService(DigestCadence.DAILY, [
      "BOOKS",
      "GAMES",
    ]);
    const created = await service.scan("u1");
    expect(created).toBe(0);
    // Filtered before any episode lookup.
    expect(prisma.episode.findMany).not.toHaveBeenCalled();
  });
});

describe("NotificationService — bell feed (read = deleted)", () => {
  function makeService() {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(prisma, jobRunsStub, eventsStub);
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

  it("reports every pending row as unread (existence = unread)", async () => {
    const { service, prisma } = makeService();
    (prisma.notification.count as Mock).mockResolvedValueOnce(2);
    (prisma.notification.findMany as Mock).mockResolvedValueOnce([
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

  it("counts unread past the feed cap instead of stopping at the listed rows", async () => {
    const { service, prisma } = makeService();
    (prisma.notification.findMany as Mock).mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, i) => ({
        id: `n${i}`,
        type: "FOLLOW",
        title: "Alice",
        data: {},
        createdAt: new Date(),
      })),
    );
    (prisma.notification.count as Mock).mockResolvedValueOnce(137);

    const feed = await service.feed("u1");

    expect(feed.notifications).toHaveLength(50);
    expect(feed.unread).toBe(137);
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
    (prisma.notification.deleteMany as Mock).mockResolvedValueOnce({
      count: 0,
    });
    await expect(service.markRead("u1", "missing")).rejects.toBeInstanceOf(
      AppException,
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

describe("NotificationService.create — realtime push", () => {
  function makeService(createManyCount: number) {
    const prisma = {
      notification: {
        createMany: vi.fn().mockResolvedValue({ count: createManyCount }),
      },
    } as unknown as PrismaService;
    const events = { emitToUser: vi.fn() } as unknown as EventsGateway;
    const service = new NotificationService(prisma, jobRunsStub, events);
    return { service, events, prisma };
  }

  it("pushes a live event for a bell-visible kind that was actually created", async () => {
    const { service, events } = makeService(1);
    await service.create({
      userId: "u1",
      type: NotificationType.FOLLOW,
      title: "Alice te suit",
    });
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });

  it("skips the push when createMany deduped the row away", async () => {
    const { service, events } = makeService(0);
    await service.create({
      userId: "u1",
      type: NotificationType.FOLLOW,
      title: "Alice te suit",
    });
    expect(events.emitToUser).not.toHaveBeenCalled();
  });

  it("skips the push for a kind the bell feed never shows", async () => {
    const { service, events } = makeService(1);
    await service.create({
      userId: "u1",
      type: NotificationType.NEW_EPISODE,
      title: "S2E5",
    });
    expect(events.emitToUser).not.toHaveBeenCalled();
  });

  it("writes on the caller's transaction without publishing before commit", async () => {
    const { service, events, prisma } = makeService(1);
    const tx = {
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;

    await service.createInTransaction(tx, {
      userId: "u1",
      type: NotificationType.REPORT_RESOLVED,
      title: "Ton signalement a été traité",
    });

    expect(tx.notification.createMany).toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(events.emitToUser).not.toHaveBeenCalled();
    service.publishCreated("u1", NotificationType.REPORT_RESOLVED);
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });
});
