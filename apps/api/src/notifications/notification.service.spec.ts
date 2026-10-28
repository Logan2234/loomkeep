import { DigestCadence, NotificationType } from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
import type { EventsGateway } from "../events/events.gateway";
import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";
import type { PushService } from "./push.service";

// Runs `fn` straight through without touching the DB, for services under test
// that don't exercise job-recording behaviour themselves.
const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

const eventsStub = { emitToUser: vi.fn() } as unknown as EventsGateway;

const pushStub = { sendToUser: vi.fn() } as unknown as PushService;

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
      sagaMember: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameSagaMember: { findMany: vi.fn().mockResolvedValue([]) },
      libraryEntry: {
        findMany: vi
          .fn()
          .mockImplementation(
            (args: { where: { movieReleaseReminderAt?: unknown } }) =>
              Promise.resolve(
                args.where.movieReleaseReminderAt
                  ? []
                  : (over.entries ?? [
                      {
                        userId: "u1",
                        mediaItemId: "m1",
                        createdAt: TRACKED_SINCE,
                      },
                    ]),
              ),
          ),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue(over.existing ?? []),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      eventsStub,
      pushStub,
      {} as never,
    );
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
    expect(prisma.libraryEntry.findMany).toHaveBeenCalledOnce();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("applies the digest and domain gates in the entry query", async () => {
    const { service, prisma } = makeService({});

    await service.scanAll();

    const where = (prisma.libraryEntry.findMany as Mock).mock.calls[1][0].where;
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
      body: "S02E05 · Le dénouement",
      dedupeKey: "episode:ep1",
    });
  });

  it.each([
    { number: 5, title: "Episode title", body: "S02E05 · Episode title" },
    { number: 5, title: null, body: "S02E05" },
    { number: 105, title: "Episode title", body: "S02E105 · Episode title" },
  ])(
    "pads episode codes in notifications: $body",
    async ({ number, title, body }) => {
      const { service, prisma } = makeService({
        episodes: [episodeRow({ number, title })],
      });

      await service.scanAll();

      const rows = (prisma.notification.createMany as Mock).mock.calls[0][0]
        .data;
      expect(rows[0].body).toBe(body);
    },
  );

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
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameSagaMember: { findMany: vi.fn().mockResolvedValue([]) },
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
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      eventsStub,
      pushStub,
      {} as never,
    );
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
          body: "S02E05 · The One With The Finale",
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

const BELL_TYPES = {
  notIn: [
    NotificationType.NEW_EPISODE,
    NotificationType.NEW_MOVIE,
    NotificationType.NEW_GAME,
    NotificationType.FOLLOW_REQUEST,
  ],
};

describe("NotificationService — bell and history", () => {
  function makeService(over: { seenAt?: Date | null; row?: unknown } = {}) {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi
          .fn()
          .mockResolvedValue(
            "row" in over ? over.row : { readAt: null as Date | null },
          ),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ notificationsSeenAt: over.seenAt ?? null }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const events = { emitToUser: vi.fn() } as unknown as EventsGateway;
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      events,
      pushStub,
      {} as never,
    );
    return { service, prisma, events };
  }

  const row = (id: string, readAt: Date | null = null) => ({
    id,
    type: "FOLLOW",
    title: "Alice",
    body: null,
    url: null,
    data: {},
    createdAt: new Date("2026-10-13T20:00:00Z"),
    readAt,
  });

  it("keeps read entries in the history, with when they were read", async () => {
    const { service, prisma } = makeService();
    const readAt = new Date("2026-10-13T21:00:00Z");
    (prisma.notification.findMany as Mock).mockResolvedValueOnce([
      row("n1"),
      row("n2", readAt),
      row("n3", readAt),
    ]);

    const page = await service.history(
      "u1",
      { page: 1, limit: 2, skip: 0, take: 2 },
      false,
    );

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", type: BELL_TYPES },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 3,
    });
    expect(page.hasMore).toBe(true);
    expect(page.items.map((n) => [n.id, n.readAt])).toEqual([
      ["n1", null],
      ["n2", readAt.toISOString()],
    ]);
  });

  it("filters the history down to unread entries on request", async () => {
    const { service, prisma } = makeService();

    await service.history(
      "u1",
      { page: 2, limit: 20, skip: 20, take: 20 },
      true,
    );

    expect(
      (prisma.notification.findMany as Mock).mock.calls[0][0].where,
    ).toEqual({ userId: "u1", type: BELL_TYPES, readAt: null });
  });

  it("counts as unseen only what arrived after the bell was last opened", async () => {
    const seenAt = new Date("2026-10-13T18:00:00Z");
    const { service, prisma } = makeService({ seenAt });
    (prisma.notification.count as Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    expect(await service.counts("u1")).toEqual({ unread: 5, unseen: 2 });
    expect((prisma.notification.count as Mock).mock.calls[1][0].where).toEqual({
      userId: "u1",
      type: BELL_TYPES,
      readAt: null,
      createdAt: { gt: seenAt },
    });
  });

  it("counts every unread entry as unseen until the bell is first opened", async () => {
    const { service, prisma } = makeService({ seenAt: null });
    (prisma.notification.count as Mock).mockResolvedValueOnce(4);

    expect(await service.counts("u1")).toEqual({ unread: 4, unseen: 4 });
    expect(prisma.notification.count).toHaveBeenCalledOnce();
  });

  it("opening the bell marks everything seen, on every device", async () => {
    const { service, prisma, events } = makeService();

    await service.markSeen("u1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { notificationsSeenAt: expect.any(Date) },
    });
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });

  it("marks an entry read instead of deleting it", async () => {
    const { service, prisma, events } = makeService();

    await service.markRead("u1", "n1");

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
      select: { readAt: true },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });

  it("keeps the first read date when an entry is read again", async () => {
    const { service, prisma } = makeService({
      row: { readAt: new Date("2026-10-01T00:00:00Z") },
    });

    await service.markRead("u1", "n1");

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("marks a read entry unread again", async () => {
    const { service, prisma } = makeService({
      row: { readAt: new Date("2026-10-01T00:00:00Z") },
    });

    await service.markUnread("u1", "n1");

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: null },
    });
  });

  it("answers 404 for someone else's entry", async () => {
    const { service } = makeService({ row: null });

    await expect(service.markRead("u1", "missing")).rejects.toBeInstanceOf(
      AppException,
    );
    await expect(service.markUnread("u1", "missing")).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it("marks every unread bell entry read at once", async () => {
    const { service, prisma } = makeService();

    await service.markAllRead("u1");

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", type: BELL_TYPES, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes one entry of the account on request, and 404s otherwise", async () => {
    const { service, prisma } = makeService();

    await service.remove("u1", "n1");
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
    });

    (prisma.notification.deleteMany as Mock).mockResolvedValueOnce({
      count: 0,
    });
    await expect(service.remove("u1", "missing")).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it("reads a follow request's hidden row once the request is settled", async () => {
    const { service, prisma } = makeService();

    await service.settleFollowRequest("me", "requester");

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "me", dedupeKey: "request:requester", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("NotificationService.purge", () => {
  it("drops what was read 90 days ago and releases past 30 days, never unread entries", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new NotificationService(
      { notification: { deleteMany } } as unknown as PrismaService,
      jobRunsStub,
      eventsStub,
      pushStub,
      {} as never,
    );
    const now = new Date("2026-10-14T07:00:00Z");

    await service.purge(now);

    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { readAt: { lt: new Date("2026-07-16T07:00:00Z") } },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        type: {
          in: [
            NotificationType.NEW_EPISODE,
            NotificationType.NEW_MOVIE,
            NotificationType.NEW_GAME,
          ],
        },
        createdAt: { lt: new Date("2026-09-14T07:00:00Z") },
      },
    });
  });
});

describe("NotificationService.create — realtime push", () => {
  function makeService(created: { id: string }[]) {
    const prisma = {
      notification: {
        createManyAndReturn: vi.fn().mockResolvedValue(created),
      },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const events = { emitToUser: vi.fn() } as unknown as EventsGateway;
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      events,
      pushStub,
      {} as never,
    );
    return { service, events, prisma };
  }

  it("pushes a live event for a bell-visible kind that was actually created", async () => {
    const { service, events } = makeService([{ id: "n1" }]);
    await service.create({
      userId: "u1",
      type: NotificationType.FOLLOW,
      title: "Alice te suit",
    });
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });

  it("skips the push when the dedupe key was already taken", async () => {
    const { service, events } = makeService([]);
    await service.create({
      userId: "u1",
      type: NotificationType.FOLLOW,
      title: "Alice te suit",
    });
    expect(events.emitToUser).not.toHaveBeenCalled();
  });

  it("skips the push for a kind the bell feed never shows", async () => {
    const { service, events } = makeService([{ id: "n1" }]);
    await service.create({
      userId: "u1",
      type: NotificationType.NEW_EPISODE,
      title: "S2E5",
    });
    expect(events.emitToUser).not.toHaveBeenCalled();
  });

  it("writes on the caller's transaction without publishing before commit", async () => {
    const { service, events, prisma } = makeService([{ id: "n1" }]);
    const tx = {
      notification: {
        createManyAndReturn: vi.fn().mockResolvedValue([{ id: "n9" }]),
      },
    } as unknown as Prisma.TransactionClient;

    const id = await service.createInTransaction(tx, {
      userId: "u1",
      type: NotificationType.REPORT_RESOLVED,
      title: "Ton signalement a été traité",
    });

    expect(id).toBe("n9");
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(events.emitToUser).not.toHaveBeenCalled();
    service.publishCreated("u1", NotificationType.REPORT_RESOLVED);
    expect(events.emitToUser).toHaveBeenCalledWith("u1", "notification");
  });
});

describe("NotificationService push", () => {
  function makeService(user: { locale: string; alertPrefs: unknown } | null) {
    const prisma = {
      notification: {
        createManyAndReturn: vi.fn().mockResolvedValue([{ id: "n1" }]),
      },
      user: { findUnique: vi.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;
    const push = { sendToUser: vi.fn() } as unknown as PushService;
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      eventsStub,
      push,
      {} as never,
    );
    return { service, push };
  }

  const reply = {
    userId: "u1",
    type: NotificationType.COMMENT_REPLY,
    title: "Alice",
    body: "Totally agree",
    url: "/app/media/series/42",
  };

  it("pushes a reply to someone who turned that push on, saying why", async () => {
    const { service, push } = makeService({
      locale: "en",
      alertPrefs: { COMMENT_REPLY: { push: true } },
    });

    await service.create(reply);

    // The id lets opening the push mark the bell entry read.
    expect(push.sendToUser).toHaveBeenCalledWith("u1", {
      title: "Alice replied to you",
      body: "Totally agree",
      url: "/app/media/series/42",
      notificationId: "n1",
      group: "activity",
      // A bell entry's push gets "Mark as read" when nothing else is set.
      actions: [
        { action: "notification.read", label: "Mark as read", target: {} },
      ],
    });
  });

  it("keeps it to the bell by default", async () => {
    const { service, push } = makeService({ locale: "en", alertPrefs: {} });

    await service.create(reply);

    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it("never pushes a kind that has no push", async () => {
    const { service, push } = makeService({
      locale: "en",
      alertPrefs: { API_KEYS_REVIEW: { push: true } },
    });

    await service.create({
      ...reply,
      type: NotificationType.API_KEYS_REVIEW,
    });

    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});

describe("NotificationService.createOrGroup", () => {
  function makeService(existing: unknown) {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn(),
        createManyAndReturn: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          locale: "en",
          alertPrefs: { LIST_ITEM_ADDED: { push: true } },
          suspendedUntil: null,
        }),
      },
    } as unknown as PrismaService;
    const push = { sendToUser: vi.fn() } as unknown as PushService;
    const service = new NotificationService(
      prisma,
      jobRunsStub,
      eventsStub,
      push,
      {} as never,
    );
    return { service, prisma, push };
  }

  const added = {
    userId: "u1",
    type: NotificationType.LIST_ITEM_ADDED,
    title: "Bob",
    body: "added Dune",
    url: "/app/lists/l1",
    dedupeKey: "list-items:l1:bob",
    data: { listTitle: "L", itemTitle: "Dune" },
  };
  const regroup = (count: number) => ({
    body: `added ${count} titles`,
    data: { listTitle: "L" },
  });

  it("rewrites the unread entry with the new total instead of adding one", async () => {
    const { service, prisma, push } = makeService({
      id: "n1",
      data: { count: 2 },
      readAt: null,
    });

    await service.createOrGroup(added, regroup);

    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: {
        body: "added 3 titles",
        data: { listTitle: "L", count: 3 },
        createdAt: expect.any(Date),
      },
    });
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it("starts a new group once the previous one was read, and pushes it", async () => {
    // Left as it was, the read row would hold the key: every later title
    // added to that list by that editor would go unnoticed for 90 days.
    const { service, prisma, push } = makeService({
      id: "n1",
      data: { count: 4 },
      readAt: new Date("2026-10-10T00:00:00Z"),
    });

    await service.createOrGroup(added, regroup);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: {
        title: "Bob",
        body: "added Dune",
        url: "/app/lists/l1",
        data: { listTitle: "L", itemTitle: "Dune" },
        createdAt: expect.any(Date),
        readAt: null,
      },
    });
    expect(push.sendToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ notificationId: "n1" }),
    );
  });
});
