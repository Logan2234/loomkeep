import { ProfileAccess, VisibilityAudience } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { BlockService } from "./block.service";
import { VisibilityService } from "./visibility.service";

const VIEWER = "viewer-1";
const TARGET = { id: "target-1", profileAccess: ProfileAccess.PUBLIC };

type Follow = { status: "ACCEPTED" | "PENDING" } | null;

/**
 * `follow.findUnique` is called twice — outgoing (viewer → target) then
 * incoming — and both run inside one Promise.all, so they're distinguished
 * by their `where` rather than by call order.
 */
function make(options: {
  outgoing?: Follow;
  incoming?: Follow;
  blocks?: { blockerId: string }[];
}) {
  const findUnique = vi.fn(
    ({ where }: { where: { followerId_followeeId: { followerId: string } } }) =>
      Promise.resolve(
        where.followerId_followeeId.followerId === VIEWER
          ? (options.outgoing ?? null)
          : (options.incoming ?? null),
      ),
  );
  const prisma = {
    follow: { findUnique },
    visibilitySetting: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const blocks = {
    findBlocksBetween: vi.fn().mockResolvedValue(options.blocks ?? []),
  } as unknown as BlockService;

  return { service: new VisibilityService(prisma, blocks), prisma, blocks };
}

describe("VisibilityService.getRelation", () => {
  it("treats the viewer as their own friend, without querying anything", async () => {
    const { service, prisma, blocks } = make({});

    const relation = await service.getRelation(VIEWER, {
      ...TARGET,
      id: VIEWER,
    });

    expect(relation.isSelf).toBe(true);
    expect(relation.isFriend).toBe(true);
    expect(prisma.follow.findUnique).not.toHaveBeenCalled();
    expect(blocks.findBlocksBetween).not.toHaveBeenCalled();
  });

  it("requires a mutual accepted follow for friendship on a public profile", async () => {
    const mutual = make({
      outgoing: { status: "ACCEPTED" },
      incoming: { status: "ACCEPTED" },
    });
    const oneWay = make({ outgoing: { status: "ACCEPTED" } });

    expect((await mutual.service.getRelation(VIEWER, TARGET)).isFriend).toBe(
      true,
    );
    expect((await oneWay.service.getRelation(VIEWER, TARGET)).isFriend).toBe(
      false,
    );
  });

  it("makes an accepted follower of a private profile a friend on its own", async () => {
    // The target approved the request, Instagram-style — no reciprocity needed.
    const { service } = make({ outgoing: { status: "ACCEPTED" } });

    const relation = await service.getRelation(VIEWER, {
      ...TARGET,
      profileAccess: ProfileAccess.PRIVATE,
    });

    expect(relation.isFriend).toBe(true);
  });

  it("reports a pending request as requested, not following", async () => {
    const { service } = make({ outgoing: { status: "PENDING" } });

    const relation = await service.getRelation(VIEWER, TARGET);

    expect(relation.requested).toBe(true);
    expect(relation.following).toBe(false);
    expect(relation.isFriend).toBe(false);
  });

  it("collapses the relationship to nothing when the viewer blocks the target", async () => {
    // Even a mutual accepted follow must not survive a block in either
    // direction — this is the gate every cross-user read resolves through.
    const { service } = make({
      outgoing: { status: "ACCEPTED" },
      incoming: { status: "ACCEPTED" },
      blocks: [{ blockerId: VIEWER }],
    });

    const relation = await service.getRelation(VIEWER, TARGET);

    expect(relation).toMatchObject({
      following: false,
      followsYou: false,
      isFriend: false,
      blocking: true,
      blockedByTarget: false,
    });
  });

  it("collapses it just the same when the target blocks the viewer", async () => {
    const { service } = make({
      outgoing: { status: "ACCEPTED" },
      incoming: { status: "ACCEPTED" },
      blocks: [{ blockerId: TARGET.id }],
    });

    const relation = await service.getRelation(VIEWER, TARGET);

    expect(relation).toMatchObject({
      isFriend: false,
      blocking: false,
      blockedByTarget: true,
    });
  });

  it("never counts a ghost profile as a friend", async () => {
    const { service } = make({
      outgoing: { status: "ACCEPTED" },
      incoming: { status: "ACCEPTED" },
    });

    const relation = await service.getRelation(VIEWER, {
      ...TARGET,
      profileAccess: ProfileAccess.GHOST,
    });

    expect(relation.isFriend).toBe(false);
  });
});

describe("VisibilityService.toRelationshipDto", () => {
  it("drops the blocked-by flag, which the viewer must not learn", async () => {
    const { service } = make({ blocks: [{ blockerId: TARGET.id }] });
    const relation = await service.getRelation(VIEWER, TARGET);

    const dto = service.toRelationshipDto(relation);

    expect(relation.blockedByTarget).toBe(true);
    expect(dto).not.toHaveProperty("blockedByTarget");
    expect(dto.blocking).toBe(false);
  });
});

describe("VisibilityService facet audiences", () => {
  it("keys stored settings by domain and facet", async () => {
    const { service, prisma } = make({});
    (prisma.visibilitySetting.findMany as Mock).mockResolvedValue([
      {
        domain: "MEDIA",
        facet: "LIBRARY",
        audience: VisibilityAudience.PUBLIC,
      },
    ]);

    const settings = await service.getSettingsMap("user-1");

    expect(settings.get("MEDIA:LIBRARY")).toBe(VisibilityAudience.PUBLIC);
  });

  it("falls back to the coded default for a facet that was never set", () => {
    const { service } = make({});

    expect(service.audienceFor(new Map(), "MEDIA", "LIBRARY")).toBe(
      VisibilityAudience.FRIENDS,
    );
  });
});
