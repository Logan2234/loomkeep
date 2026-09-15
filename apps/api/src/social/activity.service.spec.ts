import { ProfileAccess, VisibilityAudience } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "./activity.service";
import type { VisibilityService } from "./visibility.service";
import type { ViewerRelation } from "./visibility.util";

const ACTOR = "actor-1";
const VIEWER = "viewer-1";

function relation(over: Partial<ViewerRelation> = {}): ViewerRelation {
  return {
    isSelf: false,
    following: true,
    requested: false,
    followsYou: true,
    isFriend: true,
    blocking: false,
    blockedByTarget: false,
    ...over,
  };
}

function eventRow(over: Record<string, unknown> = {}) {
  return {
    id: "e1",
    userId: ACTOR,
    type: "PROGRESS",
    domain: "MEDIA",
    targetType: "MEDIA",
    targetId: "m1",
    level: "WORK",
    homeFeed: true,
    title: "Une série",
    imageUrl: null,
    href: "/app/media/series/m1",
    data: {},
    createdAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  };
}

function make(
  options: {
    events?: unknown[];
    follows?: { followeeId: string }[];
    audience?: VisibilityAudience;
    relation?: ViewerRelation;
    actorAccess?: ProfileAccess;
  } = {},
) {
  const prisma = {
    activityEvent: {
      findMany: vi.fn().mockResolvedValue(options.events ?? []),
      create: vi.fn().mockResolvedValue({}),
    },
    follow: { findMany: vi.fn().mockResolvedValue(options.follows ?? []) },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: ACTOR,
        profileAccess: options.actorAccess ?? ProfileAccess.PUBLIC,
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: ACTOR,
          username: "acteur",
          displayName: "Acteur",
          avatarUpdatedAt: null,
        },
      ]),
    },
    list: { findMany: vi.fn().mockResolvedValue([]) },
    mediaItem: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;

  const visibility = {
    getRelation: vi.fn().mockResolvedValue(options.relation ?? relation()),
    getSettingsMap: vi.fn().mockResolvedValue(new Map()),
    audienceFor: vi
      .fn()
      .mockReturnValue(options.audience ?? VisibilityAudience.PUBLIC),
  } as unknown as VisibilityService;

  return {
    service: new ActivityService(prisma, visibility),
    prisma,
    visibility,
  };
}

describe("ActivityService.emit", () => {
  it("never lets a feed-write failure escape into the user's action", async () => {
    // emit() is fire-and-forget from every caller: marking an episode watched
    // must not fail because the feed row couldn't be written.
    const { service, prisma } = make();
    vi.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    (prisma.mediaItem.findUnique as Mock).mockRejectedValue(new Error("boom"));

    await expect(
      service.emit({
        userId: ACTOR,
        type: "PROGRESS",
        domain: "MEDIA",
        targetType: "MEDIA",
        targetId: "m1",
      }),
    ).resolves.toBeUndefined();

    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
  });

  it("writes nothing when the target has no resolvable snapshot", async () => {
    // A feed row with no title or link would render as an empty card.
    const { service, prisma } = make();

    await service.emit({
      userId: ACTOR,
      type: "PROGRESS",
      domain: "MEDIA",
      targetType: "MEDIA",
      targetId: "gone",
    });

    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
  });
});

describe("ActivityService.homeFeed", () => {
  it("returns an empty feed without querying events when nobody is followed", async () => {
    const { service, prisma } = make({ follows: [] });

    const feed = await service.homeFeed(VIEWER);

    expect(feed).toEqual({ items: [], hasMore: false });
    expect(prisma.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it("reads only homeFeed milestones, and only from followed users", async () => {
    const { service, prisma } = make({ follows: [{ followeeId: ACTOR }] });

    await service.homeFeed(VIEWER);

    expect(
      (prisma.activityEvent.findMany as Mock).mock.calls[0][0].where,
    ).toEqual({ userId: { in: [ACTOR] }, homeFeed: true });
  });
});

describe("ActivityService feed building", () => {
  const target = { id: ACTOR, profileAccess: ProfileAccess.PUBLIC };

  it("collapses a binge into one entry carrying its count", async () => {
    const { service } = make({
      events: [
        eventRow({ id: "e1" }),
        eventRow({ id: "e2" }),
        eventRow({ id: "e3" }),
      ],
    });

    const feed = await service.profileTimeline(VIEWER, target);

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].count).toBe(3);
  });

  it("keeps events on different targets apart", async () => {
    const { service } = make({
      events: [eventRow({ id: "e1" }), eventRow({ id: "e2", targetId: "m2" })],
    });

    const feed = await service.profileTimeline(VIEWER, target);

    expect(feed.items).toHaveLength(2);
    expect(feed.items.map((i) => i.count)).toEqual([1, 1]);
  });

  it("drops every event of an actor the viewer may not see", async () => {
    // The facet gate is the whole point of this path: a private actor's
    // activity must not leak through the feed.
    const { service } = make({
      events: [eventRow()],
      audience: VisibilityAudience.FRIENDS,
      relation: relation({
        following: false,
        followsYou: false,
        isFriend: false,
      }),
    });

    const feed = await service.profileTimeline(VIEWER, target);

    expect(feed.items).toEqual([]);
  });

  it("hydrates the actor onto each entry", async () => {
    const { service } = make({ events: [eventRow()] });

    const feed = await service.profileTimeline(VIEWER, target);

    expect(feed.items[0].actor).toEqual({
      username: "acteur",
      displayName: "Acteur",
      avatarUrl: null,
    });
  });

  it("reports hasMore from the row the page overshoots by", async () => {
    const { service } = make({
      events: [
        eventRow({ id: "e1", targetId: "m1" }),
        eventRow({ id: "e2", targetId: "m2" }),
      ],
    });

    const feed = await service.profileTimeline(VIEWER, target, 1, 1);

    expect(feed.hasMore).toBe(true);
    expect(feed.items).toHaveLength(1);
  });
});
