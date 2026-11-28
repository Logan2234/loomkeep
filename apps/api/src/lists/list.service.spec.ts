import { ErrorCode } from "@loomkeep/shared/catalog";
import { LIST_LIMITS } from "@loomkeep/shared/contracts";
import type { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { vi } from "vitest";
import { notificationCopy } from "../notifications/notification-copy";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { FollowService } from "../social/follow.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { stubAchievements, stubEvents, stubXp } from "../test-utils/stubs";
import { ListService } from "./list.service";

/** `friend` is the owner's friend unless a test says otherwise. */
function stubFollow(friendIds: string[] = ["friend"]): FollowService {
  return {
    listFriendIds: vi.fn().mockResolvedValue(friendIds),
  } as unknown as FollowService;
}

const VIEWER = "viewer";

/** SOCIAL_ENABLED="true" unless overridden — most tests exercise the social-on path. */
function fakeConfig(socialEnabled = true): ConfigService {
  return {
    get: vi.fn(() => (socialEnabled ? "true" : "false")),
  } as unknown as ConfigService;
}

function fakeNotifications(): NotificationService {
  return {
    create: vi.fn(),
    createOrGroup: vi.fn(),
    copyFor: () => notificationCopy("fr"),
  } as unknown as NotificationService;
}

function relation(over: Partial<ViewerRelation> = {}): ViewerRelation {
  return {
    isSelf: false,
    following: false,
    requested: false,
    followsYou: false,
    isFriend: false,
    blocking: false,
    blockedByTarget: false,
    ...over,
  };
}

function listRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l1",
    userId: "author",
    title: "Top 10",
    description: null,
    kind: "RANKED",
    visibility: "PRIVATE",
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    members: [],
    user: { id: "author", profileAccess: "PUBLIC" },
    ...over,
  };
}

describe("ListService.getForViewer — own-visibility gate", () => {
  function make(row: ReturnType<typeof listRow>, rel: ViewerRelation) {
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...row, items: [] }),
      },
      listNotificationMute: { findUnique: vi.fn().mockResolvedValue(null) },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: row.userId,
          username: row.userId,
          displayName: row.userId,
          profileAccess: "PUBLIC",
        }),
      },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: vi.fn().mockResolvedValue(rel),
    } as unknown as VisibilityService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    return new ListService(
      prisma,
      visibility,
      activity,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
  }

  it("always shows the owner their own list, even PRIVATE", async () => {
    const svc = make(
      listRow({ userId: VIEWER, visibility: "PRIVATE" }),
      relation(),
    );
    const out = await svc.getForViewer(VIEWER, "l1");
    expect(out).not.toBeNull();
  });

  it("hides a PRIVATE list from anyone else", async () => {
    const svc = make(listRow({ visibility: "PRIVATE" }), relation());
    expect(await svc.getForViewer(VIEWER, "l1")).toBeNull();
  });

  it("shows a FRIENDS list only to a friend", async () => {
    const row = listRow({ visibility: "FRIENDS" });
    const stranger = make(row, relation({ following: true })); // not mutual
    expect(await stranger.getForViewer(VIEWER, "l1")).toBeNull();

    const friend = make(
      row,
      relation({ following: true, followsYou: true, isFriend: true }),
    );
    expect(await friend.getForViewer(VIEWER, "l1")).not.toBeNull();
  });

  it("caps a PUBLIC list to friends when the author's profile is private", async () => {
    const publicAuthor = make(
      listRow({
        visibility: "PUBLIC",
        user: { id: "author", profileAccess: "PUBLIC" },
      }),
      relation(),
    );
    expect(await publicAuthor.getForViewer(VIEWER, "l1")).not.toBeNull();

    const privateRow = listRow({
      visibility: "PUBLIC",
      user: { id: "author", profileAccess: "PRIVATE" },
    });
    expect(
      await make(privateRow, relation()).getForViewer(VIEWER, "l1"),
    ).toBeNull();
    expect(
      await make(
        privateRow,
        relation({ following: true, followsYou: true, isFriend: true }),
      ).getForViewer(VIEWER, "l1"),
    ).not.toBeNull();
  });

  it("hides the list when either side blocks", async () => {
    const svc = make(
      listRow({ visibility: "PUBLIC" }),
      relation({ blockedByTarget: true }),
    );
    expect(await svc.getForViewer(VIEWER, "l1")).toBeNull();
  });
});

describe("ListService.messageCards — a list attached to a message", () => {
  function make(rows: ReturnType<typeof listRow>[]) {
    const prisma = {
      list: { findMany: vi.fn().mockResolvedValue(rows) },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: vi
        .fn()
        .mockResolvedValue(
          relation({ following: true, followsYou: true, isFriend: true }),
        ),
    } as unknown as VisibilityService;
    return new ListService(
      prisma,
      visibility,
      { emit: vi.fn() } as unknown as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
  }

  const row = (over: Partial<Record<string, unknown>>) =>
    listRow({
      user: { id: "author", profileAccess: "PUBLIC", displayName: "Léa" },
      _count: { items: 13 },
      ...over,
    });

  it("leaves out a PRIVATE list, unless the viewer edits it", async () => {
    const svc = make([
      row({ id: "private", visibility: "PRIVATE" }),
      row({
        id: "edited",
        visibility: "PRIVATE",
        members: [{ userId: VIEWER }],
      }),
      row({ id: "friends", visibility: "FRIENDS" }),
    ]);

    const cards = await svc.messageCards(VIEWER, [
      "private",
      "edited",
      "friends",
    ]);

    expect([...cards.keys()]).toEqual(["edited", "friends"]);
    expect(cards.get("friends")).toMatchObject({
      itemCount: 13,
      ownerName: "Léa",
      mine: false,
    });
  });
});

describe("ListService.listForUser — editor lists on a profile", () => {
  function userSummary(id: string) {
    return {
      id,
      username: id,
      displayName: id,
      profileAccess: "PUBLIC",
      avatarUpdatedAt: null,
    };
  }

  function make(relationByOwnerId: Record<string, ViewerRelation>) {
    const ownRows = [
      listRow({
        id: "own-1",
        userId: "profile-user",
        visibility: "PUBLIC",
        _count: { items: 0 },
      }),
    ];
    const editorRows = [
      listRow({
        id: "shared-1",
        userId: "real-owner",
        visibility: "PRIVATE",
        user: { id: "real-owner", profileAccess: "PUBLIC" },
        _count: { items: 0 },
      }),
    ];
    const listFindMany = vi
      .fn()
      .mockResolvedValueOnce(ownRows)
      .mockResolvedValueOnce(editorRows);
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "profile-user", profileAccess: "PUBLIC" }),
        findUniqueOrThrow: vi.fn((args: { where: { id: string } }) =>
          Promise.resolve(userSummary(args.where.id)),
        ),
      },
      list: { findMany: listFindMany },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: vi.fn((_viewerId: string, target: { id: string }) =>
        Promise.resolve(relationByOwnerId[target.id] ?? relation()),
      ),
    } as unknown as VisibilityService;
    const svc = new ListService(
      prisma,
      visibility,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    return { svc };
  }

  it("shows both owned and editor lists on the profile owner's own view, ignoring visibility", async () => {
    const { svc } = make({});
    const out = await svc.listForUser("profile-user", "profile-user");
    expect(out.map((l) => l.id).sort()).toEqual(["own-1", "shared-1"]);
  });

  it("gates an editor list by the real owner's visibility, not the profile's", async () => {
    const { svc } = make({ "real-owner": relation() }); // stranger, not a friend
    const out = await svc.listForUser("stranger", "profile-user");
    expect(out.map((l) => l.id)).toEqual(["own-1"]);
  });
});

describe("ListService.addItem", () => {
  function make(dup: boolean, itemCount = 0) {
    const create = vi.fn().mockResolvedValue({
      id: "i1",
      targetType: "MEDIA",
      targetId: "m1",
      position: 0,
      addedAt: new Date(),
    });
    const listUpdate = vi.fn();
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "u1" })),
        update: listUpdate,
      },
      listItem: {
        findUnique: vi.fn().mockResolvedValue(dup ? { id: "existing" } : null),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(itemCount),
        create,
      },
      // addItem's per-list lock, then the callback against the same double.
      $executeRaw: vi.fn(),
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      listMember: { findMany: vi.fn().mockResolvedValue([]) },
      mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      events,
      stubFollow(),
    );
    return { svc, create, activity, events, listUpdate };
  }

  it("rejects a duplicate item", async () => {
    const { svc } = make(true);
    await expect(
      svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" }),
    ).rejects.toThrow("Already in this list");
  });

  it("reports the same conflict when another editor adds the work first", async () => {
    const { svc, create, activity } = make(false);
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" }),
    ).rejects.toThrow("Already in this list");
    expect(activity.emit).not.toHaveBeenCalled();
  });

  it("adds a new item, emits LIST_ITEM_ADDED and pushes a live update", async () => {
    const { svc, create, activity, events } = make(false);
    await svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 0, addedById: "u1" }),
      }),
    );
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_ITEM_ADDED", targetId: "l1" }),
    );
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  // A list had no bound: imports and additions grew it to sizes the list
  // screen loads in one go (audit 2026-11-17, PRF-04).
  it("refuses an item past the list's limit", async () => {
    const { svc, create } = make(false, LIST_LIMITS.items);
    await expect(
      svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" }),
    ).rejects.toMatchObject({ code: ErrorCode.ListItemLimitReached });
    expect(create).not.toHaveBeenCalled();
  });

  // Moves the reorder lock forward, so an editor who loaded the list before
  // this addition gets a 409 instead of an order missing the new item.
  it("marks the list as changed", async () => {
    const { svc, listUpdate } = make(false);
    await svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" });
    expect(listUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});

describe("ListService.removeItem", () => {
  function make(deleted: number) {
    const listUpdate = vi.fn();
    const deleteMany = vi.fn().mockResolvedValue({ count: deleted });
    const executeRaw = vi.fn();
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "u1" })),
        update: listUpdate,
      },
      listItem: { deleteMany },
      $executeRaw: executeRaw,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    } as unknown as PrismaService;
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      events,
      stubFollow(),
    );
    return { svc, listUpdate, deleteMany, executeRaw, events };
  }

  it("removes the item under the list lock and marks the list as changed", async () => {
    const { svc, listUpdate, deleteMany, executeRaw, events } = make(1);
    await svc.removeItem("u1", "l1", "i1");
    expect(executeRaw).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "i1", listId: "l1" },
    });
    expect(listUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { updatedAt: expect.any(Date) },
    });
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  it("404s on an item of another list, without touching the list", async () => {
    const { svc, listUpdate } = make(0);
    await expect(svc.removeItem("u1", "l1", "elsewhere")).rejects.toMatchObject(
      {
        status: 404,
      },
    );
    expect(listUpdate).not.toHaveBeenCalled();
  });
});

describe("ListService.setItemNote", () => {
  function make(updated: number) {
    const updateMany = vi.fn().mockResolvedValue({ count: updated });
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "u1" })),
      },
      listItem: {
        updateMany,
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "i1",
          targetType: "MEDIA",
          targetId: "m1",
          position: 0,
          addedAt: new Date(),
          note: "Pour Léa",
        }),
      },
      mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      { emit: vi.fn() } as unknown as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      events,
      stubFollow(),
    );
    return { svc, updateMany, events };
  }

  it("stores the trimmed note, scoped to the list, and pushes a live update", async () => {
    const { svc, updateMany, events } = make(1);

    const item = await svc.setItemNote("u1", "l1", "i1", "  Pour Léa  ");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "i1", listId: "l1" },
      data: { note: "Pour Léa" },
    });
    expect(item.note).toBe("Pour Léa");
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  it("clears the note when given a blank one", async () => {
    const { svc, updateMany } = make(1);

    await svc.setItemNote("u1", "l1", "i1", "   ");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { note: null } }),
    );
  });

  it("404s on an item of another list", async () => {
    const { svc } = make(0);

    await expect(
      svc.setItemNote("u1", "l1", "elsewhere", "x"),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("ListService.addItem notifications", () => {
  function make(opts: { muted?: string[]; socialEnabled?: boolean } = {}) {
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "owner" })),
        update: vi.fn(),
      },
      listItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: "i1",
          targetType: "MEDIA",
          targetId: "m1",
          position: 0,
          addedAt: new Date(),
        }),
      },
      // addItem's per-list lock, then the callback against the same double.
      $executeRaw: vi.fn(),
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      listMember: {
        // canEdit: ed1 is an editor.
        findUnique: vi.fn().mockResolvedValue({ id: "lm-ed1" }),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { userId: "ed1" },
            { userId: "ed2" },
            { userId: "ed3" },
          ]),
      },
      listNotificationMute: {
        findMany: vi
          .fn()
          .mockResolvedValue((opts.muted ?? []).map((userId) => ({ userId }))),
      },
      user: {
        findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            [
              { id: "owner", locale: "fr" },
              { id: "ed2", locale: "fr" },
              { id: "ed3", locale: "en" },
            ].filter((u) => where.id.in.includes(u.id)),
          ),
        ),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "ed1",
          username: "ed1",
          displayName: "Editor One",
          profileAccess: "PUBLIC",
          avatarUpdatedAt: null,
        }),
      },
      mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const notifications = fakeNotifications();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      { emit: vi.fn() } as unknown as ActivityService,
      fakeConfig(opts.socialEnabled ?? true),
      notifications,
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    return { svc, notifications, prisma };
  }

  const add = (svc: ListService) =>
    svc.addItem("ed1", "l1", { targetType: "MEDIA", targetId: "m1" });

  type Sent = { userId: string; body: string };

  function sent(notifications: NotificationService): Sent[] {
    return (
      notifications.createOrGroup as ReturnType<typeof vi.fn>
    ).mock.calls.map((call) => call[0] as Sent);
  }

  function recipients(notifications: NotificationService): string[] {
    return sent(notifications).map((n) => n.userId);
  }

  it("tells the owner and every other editor, never the one who added it", async () => {
    const { svc, notifications } = make();
    await add(svc);
    expect(recipients(notifications).sort()).toEqual(["ed2", "ed3", "owner"]);
  });

  it("leaves out whoever muted the list", async () => {
    const { svc, notifications } = make({ muted: ["ed2"] });
    await add(svc);
    expect(recipients(notifications).sort()).toEqual(["ed3", "owner"]);
  });

  it("writes each notification in its recipient's language", async () => {
    const { svc, notifications } = make();
    await add(svc);
    const bodies = Object.fromEntries(
      sent(notifications).map((n) => [n.userId, n.body]),
    );
    expect(bodies.owner).toBe("a ajouté un élément à « Top 10 »");
    expect(bodies.ed3).toBe("added an item to “Top 10”");
  });

  it("folds one editor's additions into a single entry per list", async () => {
    const { svc, notifications } = make();
    await add(svc);
    const [call] = (
      notifications.createOrGroup as ReturnType<typeof vi.fn>
    ).mock.calls.filter((c) => (c[0] as Sent).userId === "owner");
    expect(call[0]).toMatchObject({ dedupeKey: "list-items:l1:ed1" });
    expect(call[1](3)).toMatchObject({
      body: "a ajouté 3 titres à « Top 10 »",
    });
  });

  it("notifies nobody while Social is off", async () => {
    const { svc, notifications } = make({ socialEnabled: false });
    // canEdit refuses an editor with Social off, so the owner adds it here.
    await svc.addItem("owner", "l1", { targetType: "MEDIA", targetId: "m1" });
    expect(notifications.createOrGroup).not.toHaveBeenCalled();
  });
});

describe("ListService collaborative detail", () => {
  function make(opts: { mute?: boolean } = {}) {
    const person = (id: string) => ({
      id,
      username: id,
      displayName: id,
      profileAccess: "PUBLIC",
      avatarUpdatedAt: null,
    });
    const row = listRow({
      userId: "owner",
      visibility: "PUBLIC",
      members: [{ userId: "ed" }],
      items: [
        {
          id: "a",
          targetType: "MEDIA",
          targetId: "m1",
          position: 0,
          addedAt: new Date(),
          addedBy: person("owner"),
        },
        {
          id: "b",
          targetType: "MEDIA",
          targetId: "m2",
          position: 1,
          addedAt: new Date(),
          addedBy: person("ed"),
        },
        // Left the list: still an account, no longer a collaborator.
        {
          id: "c",
          targetType: "MEDIA",
          targetId: "m3",
          position: 2,
          addedAt: new Date(),
          addedBy: person("left"),
        },
        // Deleted their account.
        {
          id: "d",
          targetType: "MEDIA",
          targetId: "m4",
          position: 3,
          addedAt: new Date(),
          addedBy: null,
        },
      ],
    });
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      },
      listMember: { findUnique: vi.fn().mockResolvedValue(null) },
      listNotificationMute: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            opts.mute ? { listId: "l1", userId: "owner" } : null,
          ),
      },
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue(person("owner")) },
      mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: vi.fn().mockResolvedValue(relation()),
    } as unknown as VisibilityService;
    return new ListService(
      prisma,
      visibility,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
  }

  it("credits each item to a current collaborator, or to a former one", async () => {
    const out = await make().getEditable("owner", "l1");
    expect(out.collaborative).toBe(true);
    expect(out.items.map((i) => i.addedBy?.username ?? i.addedBy)).toEqual([
      "owner",
      "ed",
      null,
      null,
    ]);
  });

  it("tells a visitor neither that the list has editors nor who added what", async () => {
    const out = await make().getForViewer("stranger", "l1");
    expect(out?.collaborative).toBe(false);
    expect(out?.items.every((i) => !("addedBy" in i))).toBe(true);
  });

  it("reports the viewer's own mute", async () => {
    expect(
      (await make({ mute: true }).getEditable("owner", "l1"))
        .notificationsMuted,
    ).toBe(true);
    expect((await make().getEditable("owner", "l1")).notificationsMuted).toBe(
      false,
    );
  });
});

describe("ListService list mutes and member candidates", () => {
  function make() {
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "owner" })),
      },
      listMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ userId: "b" }]),
      },
      listNotificationMute: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(["a", "b"]),
    );
    return { svc, prisma };
  }

  it("mutes idempotently and unmutes", async () => {
    const { svc, prisma } = make();
    await svc.setNotificationsMuted("owner", "l1", true);
    expect(prisma.listNotificationMute.createMany).toHaveBeenCalledWith({
      data: [{ listId: "l1", userId: "owner" }],
      skipDuplicates: true,
    });
    await svc.setNotificationsMuted("owner", "l1", false);
    expect(prisma.listNotificationMute.deleteMany).toHaveBeenCalledWith({
      where: { listId: "l1", userId: "owner" },
    });
  });

  it("offers the owner's friends who don't edit the list yet", async () => {
    const { svc, prisma } = make();
    await svc.memberCandidates("owner", "l1");
    expect(
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where,
    ).toEqual({ id: { in: ["a"] } });
  });

  it("offers candidates to the owner only", async () => {
    const { svc } = make();
    await expect(svc.memberCandidates("someone", "l1")).rejects.toThrow();
  });
});

describe("ListService.reorder", () => {
  const UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

  function make(existingIds: string[], updateManyCount = 1) {
    const calls: string[] = [];
    const executeRaw = vi.fn((strings: TemplateStringsArray) => {
      calls.push(strings.join("?").includes("pg_advisory") ? "lock" : "write");
      return Promise.resolve(existingIds.length);
    });
    const listUpdateMany = vi
      .fn()
      .mockResolvedValue({ count: updateManyCount });
    const txFindMany = vi.fn(() => {
      calls.push("read");
      return Promise.resolve(existingIds.map((id) => ({ id })));
    });
    const tx = {
      $executeRaw: executeRaw,
      list: { updateMany: listUpdateMany },
      listItem: { findMany: txFindMany },
    };
    const outerFindMany = vi.fn();
    const prisma = {
      list: {
        findUnique: vi
          .fn()
          .mockResolvedValue(listRow({ userId: "u1", updatedAt: UPDATED_AT })),
      },
      listItem: { findMany: outerFindMany },
      $transaction: vi.fn((fn) => fn(tx)),
    } as unknown as PrismaService;
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      events,
      stubFollow(),
    );
    return { svc, executeRaw, listUpdateMany, outerFindMany, calls, events };
  }

  it("rejects an order that doesn't match the list's current items", async () => {
    const { svc } = make(["a", "b", "c"]);
    await expect(
      svc.reorder("u1", "l1", ["a", "b"], UPDATED_AT.toISOString()),
    ).rejects.toThrow("orderedItemIds must match");
  });

  // An editor removing or adding an item between the check and the write
  // used to 500 (P2025 on the removed id) or leave two items on one position.
  it("checks the item set inside the transaction, under the list's lock", async () => {
    const { svc, outerFindMany, calls } = make(["a", "b", "c"]);
    await svc.reorder("u1", "l1", ["c", "a", "b"], UPDATED_AT.toISOString());
    expect(outerFindMany).not.toHaveBeenCalled();
    expect(calls).toEqual(["lock", "read", "write"]);
  });

  it("rewrites position 0..n-1 in one statement and pushes a live update", async () => {
    const { svc, executeRaw, listUpdateMany, events } = make(["a", "b", "c"]);
    await svc.reorder("u1", "l1", ["c", "a", "b"], UPDATED_AT.toISOString());
    expect(listUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1", updatedAt: UPDATED_AT },
      }),
    );
    const write = executeRaw.mock.calls.at(-1)!;
    expect(write.slice(1)).toEqual([["c", "a", "b"], [0, 1, 2], "l1"]);
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  it("rejects with a conflict when the list changed since the client loaded it, and pushes no live update", async () => {
    const { svc, calls, events } = make(["a", "b", "c"], 0);
    await expect(
      svc.reorder("u1", "l1", ["c", "a", "b"], UPDATED_AT.toISOString()),
    ).rejects.toThrow("changed since you loaded it");
    expect(calls).not.toContain("write");
    expect(events.emitToList).not.toHaveBeenCalled();
  });
});

describe("ListService.canEdit (via getEditable)", () => {
  function make(opts: {
    ownerId?: string;
    member?: boolean;
    socialEnabled?: boolean;
  }) {
    const row = listRow({ userId: opts.ownerId ?? "owner", items: [] });
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      },
      listMember: {
        findUnique: vi
          .fn()
          .mockResolvedValue(opts.member ? { id: "m1" } : null),
      },
      listNotificationMute: { findUnique: vi.fn().mockResolvedValue(null) },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: row.userId,
          username: row.userId,
          displayName: row.userId,
          profileAccess: "PUBLIC",
        }),
      },
    } as unknown as PrismaService;
    return new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(opts.socialEnabled ?? true),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
  }

  it("grants the owner OWNER access", async () => {
    const svc = make({ ownerId: "u1" });
    const out = await svc.getEditable("u1", "l1");
    expect(out.viewerRole).toBe("OWNER");
  });

  it("grants a ListMember EDITOR access", async () => {
    const svc = make({ ownerId: "owner", member: true });
    const out = await svc.getEditable("editor", "l1");
    expect(out.viewerRole).toBe("EDITOR");
  });

  it("rejects a stranger with no membership row", async () => {
    const svc = make({ ownerId: "owner", member: false });
    await expect(svc.getEditable("stranger", "l1")).rejects.toThrow();
  });

  it("rejects a ListMember when Social is disabled (defensive gate)", async () => {
    const svc = make({ ownerId: "owner", member: true, socialEnabled: false });
    await expect(svc.getEditable("editor", "l1")).rejects.toThrow();
  });
});

describe("ListService member management — owner only", () => {
  function make(ownerId: string) {
    const row = listRow({ userId: ownerId });
    const create = vi.fn().mockResolvedValue({
      id: "lm1",
      createdAt: new Date(),
    });
    const prisma = {
      list: { findUnique: vi.fn().mockResolvedValue(row) },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "friend",
          username: "friend",
          displayName: "Friend",
          profileAccess: "PUBLIC",
          avatarUpdatedAt: null,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: ownerId,
          username: ownerId,
          displayName: ownerId,
          profileAccess: "PUBLIC",
          avatarUpdatedAt: null,
        }),
      },
      listMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        create,
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      listNotificationMute: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      notification: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const notifications = fakeNotifications();
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      notifications,
      stubXp(),
      stubAchievements(),
      events,
      stubFollow(),
    );
    return { svc, create, notifications, events, prisma };
  }

  it("lets the owner add a member by username and pushes a live update", async () => {
    const { svc, create, notifications, events } = make("owner");
    const member = await svc.addMember("owner", "l1", "friend");
    expect(member.user.username).toBe("friend");
    expect(create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "friend" },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "friend",
        type: "LIST_MEMBER_ADDED",
        data: expect.objectContaining({ listTitle: "Top 10" }),
      }),
    );
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  it("answers the already-editor conflict when a concurrent add got there first", async () => {
    const { svc, create } = make("owner");
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(svc.addMember("owner", "l1", "friend")).rejects.toMatchObject({
      code: "lists.member_already_editor",
    });
  });

  it("refuses someone who isn't the owner's friend", async () => {
    const { svc, create } = make("owner");
    (svc as unknown as { follow: FollowService }).follow = stubFollow([]);

    await expect(svc.addMember("owner", "l1", "friend")).rejects.toMatchObject({
      code: "lists.member_not_friend",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a non-owner adding a member", async () => {
    const { svc } = make("owner");
    await expect(
      svc.addMember("someone-else", "l1", "friend"),
    ).rejects.toThrow();
  });

  it("lets an editor remove themselves (leave) and pushes a live update", async () => {
    const { svc, events } = make("owner");
    await expect(
      svc.removeMember("friend", "l1", "friend"),
    ).resolves.toBeUndefined();
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
    expect(events.evictFromList).toHaveBeenCalledWith("l1", "friend");
  });

  it("drops a leaving editor's mute, so a later re-add starts fresh", async () => {
    const { svc, prisma } = make("owner");
    await svc.removeMember("friend", "l1", "friend");
    expect(prisma.listNotificationMute.deleteMany).toHaveBeenCalledWith({
      where: { listId: "l1", userId: "friend" },
    });
  });

  // The "added as editor" notification stayed, and its dedupe key swallowed
  // the notification of a later re-invitation (audit 2026-11-17, BUG-64).
  it("forgets the editor's invitation notification, so a re-add notifies again", async () => {
    const { svc, prisma } = make("owner");
    await svc.removeMember("owner", "l1", "friend");
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "friend", dedupeKey: "list-member:l1:friend" },
    });
  });

  it("rejects an editor removing someone else", async () => {
    const { svc } = make("owner");
    await expect(
      svc.removeMember("friend", "l1", "someone-else"),
    ).rejects.toThrow();
  });
});

describe("ListService.reassignOwnedListsOnAccountDeletion", () => {
  function make(rows: { id: string; members: { userId: string }[] }[]) {
    const listUpdate = vi.fn();
    const listMemberDelete = vi.fn();
    const prisma = {
      list: {
        findMany: vi.fn().mockResolvedValue(rows),
        update: listUpdate,
      },
      listMember: { delete: listMemberDelete },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    return { svc, listUpdate, listMemberDelete };
  }

  it("leaves an editor-less list alone (the FK cascade handles it)", async () => {
    const { svc, listUpdate, listMemberDelete } = make([
      { id: "l1", members: [] },
    ]);
    await svc.reassignOwnedListsOnAccountDeletion("owner");
    expect(listUpdate).not.toHaveBeenCalled();
    expect(listMemberDelete).not.toHaveBeenCalled();
  });

  it("transfers a shared list to its earliest-added editor", async () => {
    const { svc, listUpdate, listMemberDelete } = make([
      { id: "l1", members: [{ userId: "editor-1" }] },
    ]);
    await svc.reassignOwnedListsOnAccountDeletion("owner");
    expect(listUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { userId: "editor-1" },
    });
    expect(listMemberDelete).toHaveBeenCalledWith({
      where: { listId_userId: { listId: "l1", userId: "editor-1" } },
    });
  });
});

describe("ListService — activity emission on create/share", () => {
  function make() {
    const row = listRow({ userId: "u1", visibility: "PRIVATE" });
    const prisma = {
      list: {
        create: vi.fn().mockResolvedValue(row),
        findUnique: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockResolvedValue({ ...row, visibility: "FRIENDS" }),
      },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ defaultListVisibility: "PRIVATE" }),
      },
    } as unknown as PrismaService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const achievements = stubAchievements();
    const events = stubEvents();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      achievements,
      events,
      stubFollow(),
    );
    return { svc, activity, achievements, events };
  }

  it("emits LIST_CREATED on create", async () => {
    const { svc, activity } = make();
    await svc.create("u1", { title: "Top 10", kind: "RANKED" as never });
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_CREATED" }),
    );
  });

  it("evaluates first_list/curator_* on create", async () => {
    const { svc, achievements } = make();
    await svc.create("u1", { title: "Top 10", kind: "RANKED" as never });
    expect(achievements.evaluate).toHaveBeenCalledWith("u1", [
      "first_list",
      "curator_bronze",
      "curator_silver",
      "curator_gold",
    ]);
  });

  it("emits LIST_SHARED only when visibility moves off PRIVATE, and pushes a live update either way", async () => {
    const { svc, activity, events } = make();
    await svc.update("u1", "l1", { visibility: "FRIENDS" as never });
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_SHARED" }),
    );
    expect(events.emitToList).toHaveBeenCalledWith("l1", "list-updated");
  });

  it("evaluates first_list/curator_* when a list is shared", async () => {
    const { svc, achievements } = make();
    await svc.update("u1", "l1", { visibility: "FRIENDS" as never });
    expect(achievements.evaluate).toHaveBeenCalledWith("u1", [
      "first_list",
      "curator_bronze",
      "curator_silver",
      "curator_gold",
    ]);
  });

  it("does not emit LIST_SHARED for a non-visibility update", async () => {
    const { svc, activity } = make();
    await svc.update("u1", "l1", { title: "New title" });
    expect(activity.emit).not.toHaveBeenCalled();
  });
});

describe("ListService — Figurant can't share a list", () => {
  function make() {
    const row = listRow({ userId: "u1", visibility: "PRIVATE" });
    const create = vi.fn().mockResolvedValue(row);
    const update = vi.fn().mockResolvedValue(row);
    const prisma = {
      list: {
        create,
        findUnique: vi.fn().mockResolvedValue(row),
        update,
      },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          defaultListVisibility: "PRIVATE",
          profileAccess: "GHOST",
        }),
      },
    } as unknown as PrismaService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    return { svc, create, update };
  }

  it("clamps a requested PUBLIC visibility to PRIVATE on create", async () => {
    const { svc, create } = make();
    await svc.create("u1", {
      title: "Top 10",
      kind: "RANKED" as never,
      visibility: "PUBLIC" as never,
    });
    expect(create.mock.calls[0][0].data.visibility).toBe("PRIVATE");
  });

  it("clamps a requested visibility change to PRIVATE on update", async () => {
    const { svc, update } = make();
    await svc.update("u1", "l1", { visibility: "FRIENDS" as never });
    expect(update.mock.calls[0][0].data.visibility).toBe("PRIVATE");
  });
});

describe("ListService — XP wiring", () => {
  it("awards LIST_CREATED on create and revokes it on remove", async () => {
    const row = listRow({ userId: "u1" });
    const prisma = {
      list: {
        create: vi.fn().mockResolvedValue(row),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ defaultListVisibility: "PRIVATE" }),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      { emit: vi.fn() } as unknown as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      xp,
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );

    await svc.create("u1", { title: "Top 10", kind: "RANKED" as never });
    expect(xp.award).toHaveBeenCalledWith("u1", "LIST_CREATED", "l1");

    await svc.remove("u1", "l1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("u1", "List", ["l1"]);
  });
});

// canEdit refuses an editor while Social is off; the "Add to a list" picker
// and its ticks still offered that editor's lists, so every pick ended in a
// 403 (audit 2026-11-17, DET-06).
describe("ListService editable lists follow canEdit's Social gate", () => {
  function make(socialEnabled: boolean) {
    const prisma = {
      list: { findMany: vi.fn().mockResolvedValue([]) },
      listItem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const svc = new ListService(
      prisma as unknown as PrismaService,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(socialEnabled),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    return { svc, prisma };
  }

  const memberOf = { members: { some: { userId: "u1" } } };

  it("offers only the user's own lists while Social is off", async () => {
    const { svc, prisma } = make(false);

    await svc.listEditable("u1");
    await svc.membershipFor("u1", "MEDIA" as never, "media-1");

    expect(prisma.list.findMany.mock.calls[0][0].where).toEqual({
      userId: "u1",
    });
    expect(prisma.listItem.findMany.mock.calls[0][0].where.list).toEqual({
      userId: "u1",
    });
  });

  it("adds the lists the user edits as a member while Social is on", async () => {
    const { svc, prisma } = make(true);

    await svc.listEditable("u1");
    await svc.membershipFor("u1", "MEDIA" as never, "media-1");

    expect(prisma.list.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ userId: "u1" }, memberOf],
    });
    expect(prisma.listItem.findMany.mock.calls[0][0].where.list).toEqual({
      OR: [{ userId: "u1" }, memberOf],
    });
  });
});

// An admin moderating a reported list may take items off it, nothing more:
// update() only refused EDITOR, so they could rename it and make a private
// list public (audit 2026-11-17, SEC-28).
describe("ListService.update by a moderating admin", () => {
  it("is refused, and the list stays as it was", async () => {
    const update = vi.fn();
    const prisma = {
      list: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            listRow({ userId: "owner", visibility: "PRIVATE" }),
          ),
        update,
      },
      listMember: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }) },
      report: { findFirst: vi.fn().mockResolvedValue({ id: "report-1" }) },
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      { emit: vi.fn() } as unknown as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );

    await expect(
      svc.update("admin", "l1", { visibility: "PUBLIC", title: "Mine now" }),
    ).rejects.toMatchObject({ code: "lists.forbidden" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ListService.addImportedItems", () => {
  it("keeps the first items up to the list's limit and says how many it left out", async () => {
    const createMany = vi.fn();
    const prisma = { listItem: { createMany } } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
      stubEvents(),
      stubFollow(),
    );
    const items = Array.from({ length: LIST_LIMITS.items + 3 }, (_, i) => ({
      targetType: "MEDIA" as const,
      targetId: `m${i}`,
      note: null,
    }));

    await expect(svc.addImportedItems("u1", "l1", items)).resolves.toBe(3);
    expect(createMany.mock.calls[0][0].data).toHaveLength(LIST_LIMITS.items);
    expect(createMany.mock.calls[0][0].data.at(-1).targetId).toBe(
      `m${LIST_LIMITS.items - 1}`,
    );
  });
});
