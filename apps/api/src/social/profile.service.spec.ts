import { VisibilityAudience } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
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
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "target", profileAccess: targetAccess }),
    },
  } as unknown as PrismaService;
  const visibility = {
    getRelation: vi.fn().mockResolvedValue(rel),
  } as unknown as VisibilityService;
  const follow = {
    listFollowers: vi.fn().mockResolvedValue([{ id: "u1" }]),
    listFollowing: vi.fn().mockResolvedValue([{ id: "u2" }]),
  } as unknown as FollowService;
  // Not exercised by these tests (only getProfile reads gamification config).
  const config = { get: vi.fn() } as unknown as ConfigService;
  const flags = {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
  return {
    svc: new ProfileService(prisma, visibility, follow, config, flags),
    follow,
  };
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

describe("ProfileService.getProfile xp", () => {
  function makeFullProfile(opts: {
    rel: ViewerRelation;
    hideProgression?: boolean;
    activityAudience?: VisibilityAudience;
    gamificationEnabled?: boolean;
    userScoreXp?: number | null;
  }) {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "target",
          username: "alice",
          displayName: "Alice",
          bio: null,
          profileAccess: "PUBLIC",
          createdAt: new Date("2024-01-01"),
          avatarUpdatedAt: null,
          hideProgression: opts.hideProgression ?? false,
          equippedBadgeKeys: [],
        }),
      },
      userAchievement: { findMany: vi.fn().mockResolvedValue([]) },
      follow: { count: vi.fn().mockResolvedValue(0) },
      review: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { count: vi.fn().mockResolvedValue(0) },
      list: { findMany: vi.fn().mockResolvedValue([]) },
      // resolveFacet always returns true for a self-viewer regardless of the
      // audience setting, so the self-view tests below still hit these.
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      gameEntry: { count: vi.fn().mockResolvedValue(0) },
      bookEntry: { count: vi.fn().mockResolvedValue(0) },
      musicEntry: { count: vi.fn().mockResolvedValue(0) },
      episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
      userScore: {
        findUnique:
          opts.userScoreXp === undefined
            ? vi.fn().mockResolvedValue(null)
            : vi.fn().mockResolvedValue({ xp: opts.userScoreXp }),
      },
    } as unknown as PrismaService;

    const visibility = {
      getRelation: vi.fn().mockResolvedValue(opts.rel),
      getSettingsMap: vi.fn().mockResolvedValue(new Map()),
      // LIBRARY facet forced to NONE so per-domain counts (unrelated to this
      // ticket) stay untouched; ACTIVITY is the one this suite drives.
      audienceFor: vi.fn((_settings, _domain, facet) =>
        facet === "ACTIVITY"
          ? (opts.activityAudience ?? VisibilityAudience.PUBLIC)
          : VisibilityAudience.NONE,
      ),
      toRelationshipDto: vi.fn().mockReturnValue({
        isSelf: opts.rel.isSelf,
        following: false,
        requested: false,
        followsYou: false,
        isFriend: false,
        blocking: false,
      }),
    } as unknown as VisibilityService;

    const follow = {} as unknown as FollowService;
    const config = { get: vi.fn() } as unknown as ConfigService;
    const flags = {
      isEnabled: vi.fn(
        (_name: string, fallback: boolean) =>
          opts.gamificationEnabled ?? fallback,
      ),
    } as unknown as FeatureFlagsService;

    return new ProfileService(prisma, visibility, follow, config, flags);
  }

  it("returns 0 xp (not null) for a brand-new account with no UserScore row", async () => {
    const svc = makeFullProfile({
      rel: relation({ isSelf: true }),
      gamificationEnabled: true,
    });
    const profile = await svc.getProfile("target", "alice");
    expect(profile.xp).toBe(0);
  });

  it("shows the owner their real xp even when hideProgression is set", async () => {
    const svc = makeFullProfile({
      rel: relation({ isSelf: true }),
      hideProgression: true,
      gamificationEnabled: true,
      userScoreXp: 250,
    });
    const profile = await svc.getProfile("target", "alice");
    expect(profile.xp).toBe(250);
  });

  it("hides xp from another viewer when the target set hideProgression", async () => {
    const svc = makeFullProfile({
      rel: relation({}),
      hideProgression: true,
      gamificationEnabled: true,
      userScoreXp: 250,
    });
    const profile = await svc.getProfile("target", "alice");
    expect(profile.xp).toBeNull();
  });

  it("hides xp from another viewer when the ACTIVITY facet isn't visible", async () => {
    const svc = makeFullProfile({
      rel: relation({}),
      activityAudience: VisibilityAudience.NONE,
      gamificationEnabled: true,
      userScoreXp: 250,
    });
    const profile = await svc.getProfile("target", "alice");
    expect(profile.xp).toBeNull();
  });

  it("never touches UserScore and returns null xp when gamification is disabled", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "target",
          username: "alice",
          displayName: "Alice",
          bio: null,
          profileAccess: "PUBLIC",
          createdAt: new Date("2024-01-01"),
          avatarUpdatedAt: null,
          hideProgression: false,
        }),
      },
      follow: { count: vi.fn().mockResolvedValue(0) },
      review: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { count: vi.fn().mockResolvedValue(0) },
      list: { findMany: vi.fn().mockResolvedValue([]) },
      // resolveFacet always returns true for a self-viewer regardless of the
      // audience setting, so the self-view tests below still hit these.
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      gameEntry: { count: vi.fn().mockResolvedValue(0) },
      bookEntry: { count: vi.fn().mockResolvedValue(0) },
      musicEntry: { count: vi.fn().mockResolvedValue(0) },
      episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
      userScore: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const visibility = {
      getRelation: vi.fn().mockResolvedValue(relation({ isSelf: true })),
      getSettingsMap: vi.fn().mockResolvedValue(new Map()),
      audienceFor: vi.fn().mockReturnValue(VisibilityAudience.NONE),
      toRelationshipDto: vi.fn().mockReturnValue({}),
    } as unknown as VisibilityService;
    const follow = {} as unknown as FollowService;
    const config = { get: vi.fn() } as unknown as ConfigService;
    const flags = {
      isEnabled: vi.fn(() => false),
    } as unknown as FeatureFlagsService;

    const svc = new ProfileService(prisma, visibility, follow, config, flags);
    const profile = await svc.getProfile("target", "alice");

    expect(profile.xp).toBeNull();
    expect(prisma.userScore.findUnique).not.toHaveBeenCalled();
  });
});
