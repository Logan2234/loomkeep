import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { ListService } from "./list.service";

// Stubbed no-op, same pattern as library.service.spec.ts (G1).
function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

const VIEWER = "viewer";

/** SOCIAL_ENABLED="true" unless overridden — most tests exercise the social-on path. */
function fakeConfig(socialEnabled = true): ConfigService {
  return {
    get: vi.fn(() => (socialEnabled ? "true" : "false")),
  } as unknown as ConfigService;
}

function fakeNotifications(): NotificationService {
  return { create: vi.fn() } as unknown as NotificationService;
}

function fakeFlags(): FeatureFlagsService {
  return {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
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
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...row, items: [] }),
      },
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
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
  function make(dup: boolean) {
    const create = vi.fn().mockResolvedValue({
      id: "i1",
      targetType: "MEDIA",
      targetId: "m1",
      position: 0,
      addedAt: new Date(),
    });
    const prisma = {
      list: {
        findUnique: vi.fn().mockResolvedValue(listRow({ userId: "u1" })),
      },
      listItem: {
        findUnique: vi.fn().mockResolvedValue(dup ? { id: "existing" } : null),
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
      mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
    const listItemUpdate = vi.fn();
    const listUpdateMany = vi
      .fn()
      .mockResolvedValue({ count: updateManyCount });
    const tx = {
      list: { updateMany: listUpdateMany },
      listItem: { update: listItemUpdate },
    };
    const prisma = {
      list: {
        findUnique: vi
          .fn()
          .mockResolvedValue(listRow({ userId: "u1", updatedAt: UPDATED_AT })),
      },
      listItem: {
        findMany: vi.fn().mockResolvedValue(existingIds.map((id) => ({ id }))),
      },
      $transaction: vi.fn((fn) => fn(tx)),
    } as unknown as PrismaService;
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      },
      listMember: {
        findUnique: vi
          .fn()
          .mockResolvedValue(opts.member ? { id: "m1" } : null),
      },
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
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
    } as unknown as PrismaService;
    const notifications = fakeNotifications();
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      {} as ActivityService,
      fakeConfig(),
      fakeFlags(),
      notifications,
      stubXp(),
      stubAchievements(),
    );
    return { svc, create, notifications };
  }

  it("lets the owner add a member by username", async () => {
    const { svc, create, notifications } = make("owner");
    const member = await svc.addMember("owner", "l1", "friend");
    expect(member.user.username).toBe("friend");
    expect(create).toHaveBeenCalledWith({
      data: { listId: "l1", userId: "friend" },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "friend",
        type: "LIST_MEMBER_ADDED",
      }),
    );
  });

  it("rejects a non-owner adding a member", async () => {
    const { svc } = make("owner");
    await expect(
      svc.addMember("someone-else", "l1", "friend"),
    ).rejects.toThrow();
  });

  it("lets an editor remove themselves (leave)", async () => {
    const { svc } = make("owner");
    await expect(
      svc.removeMember("friend", "l1", "friend"),
    ).resolves.toBeUndefined();
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
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
    const svc = new ListService(
      prisma,
      {} as VisibilityService,
      activity,
      fakeConfig(),
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      achievements,
    );
    return { svc, activity, achievements };
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

  it("emits LIST_SHARED only when visibility moves off PRIVATE", async () => {
    const { svc, activity } = make();
    await svc.update("u1", "l1", { visibility: "FRIENDS" as never });
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIST_SHARED" }),
    );
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
      fakeFlags(),
      fakeNotifications(),
      stubXp(),
      stubAchievements(),
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
      fakeFlags(),
      fakeNotifications(),
      xp,
      stubAchievements(),
    );

    await svc.create("u1", { title: "Top 10", kind: "RANKED" as never });
    expect(xp.award).toHaveBeenCalledWith("u1", "LIST_CREATED", "l1");

    await svc.remove("u1", "l1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("List", ["l1"]);
  });
});
