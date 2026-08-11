import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { ListService } from "./list.service";

const VIEWER = "viewer";

/** SOCIAL_ENABLED="true" unless overridden — most tests exercise the social-on path. */
function fakeConfig(socialEnabled = true): ConfigService {
  return {
    get: jest.fn(() => (socialEnabled ? "true" : "false")),
  } as unknown as ConfigService;
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
    user: { id: "author", profileAccess: "PUBLIC" },
    ...over,
  };
}

describe("ListService.getForViewer — own-visibility gate", () => {
  function make(row: ReturnType<typeof listRow>, rel: ViewerRelation) {
    const prisma = {
      list: {
        findUnique: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...row, items: [] }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: row.userId,
          username: row.userId,
          displayName: row.userId,
          profileAccess: "PUBLIC",
        }),
      },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: jest.fn().mockResolvedValue(rel),
    } as unknown as VisibilityService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    return new ListService(prisma, visibility, activity, fakeConfig());
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

  it("shows a PUBLIC list only when the author's profile is public", async () => {
    const publicAuthor = make(
      listRow({
        visibility: "PUBLIC",
        user: { id: "author", profileAccess: "PUBLIC" },
      }),
      relation(),
    );
    expect(await publicAuthor.getForViewer(VIEWER, "l1")).not.toBeNull();

    const privateAuthor = make(
      listRow({
        visibility: "PUBLIC",
        user: { id: "author", profileAccess: "PRIVATE" },
      }),
      relation({ following: true, followsYou: true, isFriend: true }),
    );
    // PUBLIC review-style content is capped by the author's own profileAccess.
    expect(await privateAuthor.getForViewer(VIEWER, "l1")).toBeNull();
  });

  it("hides the list when either side blocks", async () => {
    const svc = make(
      listRow({ visibility: "PUBLIC" }),
      relation({ blockedByTarget: true }),
    );
    expect(await svc.getForViewer(VIEWER, "l1")).toBeNull();
  });
});

describe("ListService.addItem", () => {
  function make(dup: boolean) {
    const create = jest.fn().mockResolvedValue({
      id: "i1",
      targetType: "MEDIA",
      targetId: "m1",
      position: 0,
      addedAt: new Date(),
    });
    const prisma = {
      list: {
        findUnique: jest.fn().mockResolvedValue(listRow({ userId: "u1" })),
      },
      listItem: {
        findUnique: jest
          .fn()
          .mockResolvedValue(dup ? { id: "existing" } : null),
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
      mediaItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
    );
    return { svc, create, activity };
  }

  it("rejects a duplicate item", async () => {
    const { svc } = make(true);
    await expect(
      svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" }),
    ).rejects.toThrow("Already in this list");
  });

  it("adds a new item and emits LIST_ITEM_ADDED", async () => {
    const { svc, create, activity } = make(false);
    await svc.addItem("u1", "l1", { targetType: "MEDIA", targetId: "m1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 0 }),
      }),
    );
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_ITEM_ADDED", targetId: "l1" }),
    );
  });
});

describe("ListService.reorder", () => {
  const UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

  function make(existingIds: string[], updateManyCount = 1) {
    const listItemUpdate = jest.fn();
    const listUpdateMany = jest
      .fn()
      .mockResolvedValue({ count: updateManyCount });
    const tx = {
      list: { updateMany: listUpdateMany },
      listItem: { update: listItemUpdate },
    };
    const prisma = {
      list: {
        findUnique: jest
          .fn()
          .mockResolvedValue(listRow({ userId: "u1", updatedAt: UPDATED_AT })),
      },
      listItem: {
        findMany: jest
          .fn()
          .mockResolvedValue(existingIds.map((id) => ({ id }))),
      },
      $transaction: jest.fn((fn) => fn(tx)),
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
    );
    return { svc, listItemUpdate, listUpdateMany };
  }

  it("rejects an order that doesn't match the list's current items", async () => {
    const { svc } = make(["a", "b", "c"]);
    await expect(
      svc.reorder("u1", "l1", ["a", "b"], UPDATED_AT.toISOString()),
    ).rejects.toThrow("orderedItemIds must match");
  });

  it("rewrites position 0..n-1 in the given order", async () => {
    const { svc, listItemUpdate, listUpdateMany } = make(["a", "b", "c"]);
    await svc.reorder("u1", "l1", ["c", "a", "b"], UPDATED_AT.toISOString());
    expect(listUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1", updatedAt: UPDATED_AT },
      }),
    );
    expect(listItemUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "c" },
      data: { position: 0 },
    });
    expect(listItemUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: "b" },
      data: { position: 2 },
    });
  });

  it("rejects with a conflict when the list changed since the client loaded it", async () => {
    const { svc, listItemUpdate } = make(["a", "b", "c"], 0);
    await expect(
      svc.reorder("u1", "l1", ["c", "a", "b"], UPDATED_AT.toISOString()),
    ).rejects.toThrow("changed since you loaded it");
    expect(listItemUpdate).not.toHaveBeenCalled();
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
        findUnique: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      },
      listMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.member ? { id: "m1" } : null),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
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
    const create = jest.fn().mockResolvedValue({
      id: "lm1",
      createdAt: new Date(),
    });
    const prisma = {
      list: { findUnique: jest.fn().mockResolvedValue(row) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "friend",
          username: "friend",
          displayName: "Friend",
          profileAccess: "PUBLIC",
          avatarUpdatedAt: null,
        }),
      },
      listMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
    );
    return { svc, create };
  }

  it("lets the owner add a member by username", async () => {
    const { svc, create } = make("owner");
    const member = await svc.addMember("owner", "l1", "friend");
    expect(member.user.username).toBe("friend");
    expect(create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "friend" },
    });
  });

  it("rejects a non-owner adding a member", async () => {
    const { svc } = make("owner");
    await expect(
      svc.addMember("someone-else", "l1", "friend"),
    ).rejects.toThrow();
  });
});

describe("ListService — activity emission on create/share", () => {
  function make() {
    const row = listRow({ userId: "u1", visibility: "PRIVATE" });
    const prisma = {
      list: {
        create: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, visibility: "FRIENDS" }),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ defaultListVisibility: "PRIVATE" }),
      },
    } as unknown as PrismaService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
    );
    return { svc, activity };
  }

  it("emits LIST_CREATED on create", async () => {
    const { svc, activity } = make();
    await svc.create("u1", { title: "Top 10", kind: "RANKED" as never });
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_CREATED" }),
    );
  });

  it("emits LIST_SHARED only when visibility moves off PRIVATE", async () => {
    const { svc, activity } = make();
    await svc.update("u1", "l1", { visibility: "FRIENDS" as never });
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_SHARED" }),
    );
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
    const create = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue(row);
    const prisma = {
      list: {
        create,
        findUnique: jest.fn().mockResolvedValue(row),
        update,
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          defaultListVisibility: "PRIVATE",
          profileAccess: "GHOST",
        }),
      },
    } as unknown as PrismaService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
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
