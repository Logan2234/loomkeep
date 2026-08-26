import type { PrismaService } from "../prisma/prisma.service";
import type { FollowService } from "./follow.service";
import { ProfileService } from "./profile.service";
import type { VisibilityService } from "./visibility.service";
import type { ViewerRelation } from "./visibility.util";

function relation(over: Partial<ViewerRelation>): ViewerRelation {
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

function make(
  targetAccess: "PUBLIC" | "PRIVATE" | "GHOST",
  rel: ViewerRelation,
) {
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "target", profileAccess: targetAccess }),
    },
  } as unknown as PrismaService;
  const visibility = {
    getRelation: jest.fn().mockResolvedValue(rel),
  } as unknown as VisibilityService;
  const follow = {
    listFollowers: jest.fn().mockResolvedValue([{ id: "u1" }]),
    listFollowing: jest.fn().mockResolvedValue([{ id: "u2" }]),
  } as unknown as FollowService;
  return { svc: new ProfileService(prisma, visibility, follow), follow };
}

describe("ProfileService.listFollowers/listFollowing", () => {
  it("returns the list for a public profile", async () => {
    const { svc, follow } = make("PUBLIC", relation({}));
    expect(await svc.listFollowers("viewer", "alice")).toEqual([{ id: "u1" }]);
    expect(follow.listFollowers).toHaveBeenCalledWith("target");
  });

  it("returns the list for an accepted friend of a private profile", async () => {
    const { svc, follow } = make(
      "PRIVATE",
      relation({ following: true, followsYou: true, isFriend: true }),
    );
    expect(await svc.listFollowing("viewer", "alice")).toEqual([{ id: "u2" }]);
    expect(follow.listFollowing).toHaveBeenCalledWith("target");
  });

  it("returns an empty list for a locked private stranger (no error)", async () => {
    const { svc, follow } = make("PRIVATE", relation({}));
    expect(await svc.listFollowers("viewer", "alice")).toEqual([]);
    expect(follow.listFollowers).not.toHaveBeenCalled();
  });

  it("404s for a GHOST profile", async () => {
    const { svc } = make("GHOST", relation({}));
    await expect(svc.listFollowers("viewer", "alice")).rejects.toThrow();
  });
});
