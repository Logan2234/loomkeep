import { NotificationType } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "./block.service";
import { FollowService } from "./follow.service";
import type { VisibilityService } from "./visibility.service";

// Minimal prisma stub: user.findUnique dispatches on whether it's queried by
// username (target/relationship lookups) or id (viewer's own profileAccess,
// or the actor lookup for a notification payload).
function makeService(opts: {
  targetAccess: "PUBLIC" | "PRIVATE";
  upsertStatus?: "ACCEPTED" | "PENDING";
  viewerAccess?: "PUBLIC" | "PRIVATE" | "GHOST";
}) {
  const create = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    user: {
      findUnique: vi.fn(
        ({ where }: { where: { username?: string; id?: string } }) => {
          if (where.username) {
            return Promise.resolve({
              id: "target",
              profileAccess: opts.targetAccess,
            });
          }

          if (where.id === "viewer") {
            return Promise.resolve({
              profileAccess: opts.viewerAccess ?? "PUBLIC",
            });
          }

          return Promise.resolve({ username: "alice", displayName: "Alice" });
        },
      ),
    },
    block: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    follow: {
      upsert: vi.fn().mockResolvedValue({
        status:
          opts.upsertStatus ??
          (opts.targetAccess === "PUBLIC" ? "ACCEPTED" : "PENDING"),
      }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;

  const visibility = {
    getRelation: vi.fn().mockResolvedValue({}),
    toRelationshipDto: vi.fn().mockReturnValue({}),
  } as unknown as VisibilityService;

  const notifications = { create } as unknown as NotificationService;
  const achievements = {
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as AchievementService;

  const blocks = new BlockService(prisma);
  const events = { emitToUser: vi.fn() } as unknown as EventsGateway;

  return {
    service: new FollowService(
      prisma,
      visibility,
      notifications,
      achievements,
      blocks,
      events,
    ),
    prisma,
    create,
    achievements,
    events,
  };
}

describe("FollowService notifications", () => {
  it("posts a FOLLOW notification when following a public profile", async () => {
    const { service, create } = makeService({ targetAccess: "PUBLIC" });
    await service.follow("viewer", "alice");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "target",
        type: NotificationType.FOLLOW,
        dedupeKey: "follow:viewer",
      }),
    );
  });

  it("evaluates the follow-family achievements for both sides once a follow is accepted", async () => {
    const { service, achievements } = makeService({ targetAccess: "PUBLIC" });
    await service.follow("viewer", "alice");
    expect(achievements.evaluate).toHaveBeenCalledWith("viewer", [
      "has_friends",
      "one_sided",
      "followers_bronze",
      "followers_silver",
      "followers_gold",
    ]);
    expect(achievements.evaluate).toHaveBeenCalledWith("target", [
      "has_friends",
      "one_sided",
      "followers_bronze",
      "followers_silver",
      "followers_gold",
    ]);
  });

  it("does not evaluate achievements for a pending (not yet accepted) request", async () => {
    const { service, achievements } = makeService({ targetAccess: "PRIVATE" });
    await service.follow("viewer", "alice");
    expect(achievements.evaluate).not.toHaveBeenCalled();
  });

  it("posts a FOLLOW_REQUEST notification when requesting a private profile", async () => {
    const { service, create } = makeService({ targetAccess: "PRIVATE" });
    await service.follow("viewer", "alice");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "target",
        type: NotificationType.FOLLOW_REQUEST,
        dedupeKey: "request:viewer",
      }),
    );
  });

  it("rejects a Figurant viewer following a non-public profile", async () => {
    const { service } = makeService({
      targetAccess: "PRIVATE",
      viewerAccess: "GHOST",
    });
    await expect(service.follow("viewer", "alice")).rejects.toThrow(
      "A Figurant can only follow public profiles",
    );
  });

  it("lets a Figurant viewer follow a public profile", async () => {
    const { service, create } = makeService({
      targetAccess: "PUBLIC",
      viewerAccess: "GHOST",
    });
    await service.follow("viewer", "alice");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.FOLLOW }),
    );
  });

  it("pushes a live update to the target when a request comes in, since FOLLOW_REQUEST never reaches the bell feed", async () => {
    const { service, events } = makeService({ targetAccess: "PRIVATE" });
    await service.follow("viewer", "alice");
    expect(events.emitToUser).toHaveBeenCalledWith(
      "target",
      "follow-request-changed",
    );
  });

  it("pushes no live update for an immediately-accepted follow (public profile)", async () => {
    const { service, events } = makeService({ targetAccess: "PUBLIC" });
    await service.follow("viewer", "alice");
    expect(events.emitToUser).not.toHaveBeenCalled();
  });
});

describe("FollowService.unfollow", () => {
  it("pushes a live update to the target when cancelling a pending request", async () => {
    const { service, prisma, events } = makeService({
      targetAccess: "PRIVATE",
    });
    (prisma.follow.findUnique as Mock).mockResolvedValue({
      status: "PENDING",
    });

    await service.unfollow("viewer", "alice");

    expect(events.emitToUser).toHaveBeenCalledWith(
      "target",
      "follow-request-changed",
    );
  });

  it("pushes nothing when unfollowing an already-accepted relationship", async () => {
    const { service, prisma, events } = makeService({
      targetAccess: "PUBLIC",
    });
    (prisma.follow.findUnique as Mock).mockResolvedValue({
      status: "ACCEPTED",
    });

    await service.unfollow("viewer", "alice");

    expect(events.emitToUser).not.toHaveBeenCalled();
  });
});

describe("FollowService.listBlocked", () => {
  it("returns the caller's blocked accounts, newest first", async () => {
    const { service, prisma } = makeService({ targetAccess: "PUBLIC" });
    (prisma.block.findMany as Mock).mockResolvedValue([
      {
        blocked: {
          id: "blocked-1",
          username: "noah",
          displayName: "Noah",
          profileAccess: "PUBLIC",
          avatarUrl: null,
        },
      },
    ]);

    await expect(service.listBlocked("viewer", 1, 20)).resolves.toEqual({
      items: [
        {
          id: "blocked-1",
          username: "noah",
          displayName: "Noah",
          profileAccess: "PUBLIC",
          avatarUrl: null,
        },
      ],
      hasMore: false,
    });

    expect(prisma.block.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blockerId: "viewer" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 21,
      }),
    );
  });
});

describe("FollowService.acceptRequest", () => {
  it("posts a FOLLOW_ACCEPTED notification to the requester on approval", async () => {
    const { service, prisma, create } = makeService({
      targetAccess: "PRIVATE",
    });
    (prisma.follow.findUnique as Mock).mockResolvedValue({
      id: "f1",
      followerId: "requester",
      followeeId: "me",
      status: "PENDING",
    });
    await service.acceptRequest("me", "f1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "requester",
        type: NotificationType.FOLLOW_ACCEPTED,
        dedupeKey: "accept:me",
      }),
    );
  });
});
