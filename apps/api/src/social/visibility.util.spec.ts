import { ProfileAccess, VisibilityAudience } from "@loomkeep/shared";
import {
  canAccessProfile,
  computeIsFriend,
  resolveFacet,
  resolveProfileVisibility,
  type ViewerRelation,
} from "./visibility.util";

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

describe("computeIsFriend", () => {
  it("PUBLIC target requires a mutual accepted follow", () => {
    expect(computeIsFriend(ProfileAccess.PUBLIC, true, true)).toBe(true);
    expect(computeIsFriend(ProfileAccess.PUBLIC, true, false)).toBe(false);
    expect(computeIsFriend(ProfileAccess.PUBLIC, false, true)).toBe(false);
  });

  it("PRIVATE target treats an accepted follow (approved) as friend-level", () => {
    expect(computeIsFriend(ProfileAccess.PRIVATE, true, false)).toBe(true);
    expect(computeIsFriend(ProfileAccess.PRIVATE, false, false)).toBe(false);
  });

  it("GHOST is never a friend", () => {
    expect(computeIsFriend(ProfileAccess.GHOST, true, true)).toBe(false);
  });
});

describe("canAccessProfile", () => {
  it("self and PUBLIC are reachable; GHOST is not", () => {
    expect(
      canAccessProfile(ProfileAccess.PRIVATE, relation({ isSelf: true })),
    ).toBe(true);
    expect(canAccessProfile(ProfileAccess.PUBLIC, relation())).toBe(true);
    expect(canAccessProfile(ProfileAccess.GHOST, relation())).toBe(false);
  });

  it("PRIVATE is reachable only by an approved follower", () => {
    expect(
      canAccessProfile(ProfileAccess.PRIVATE, relation({ following: true })),
    ).toBe(true);
    expect(canAccessProfile(ProfileAccess.PRIVATE, relation())).toBe(false);
  });

  it("a block in either direction hides the profile", () => {
    expect(
      canAccessProfile(ProfileAccess.PUBLIC, relation({ blocking: true })),
    ).toBe(false);
    expect(
      canAccessProfile(
        ProfileAccess.PUBLIC,
        relation({ blockedByTarget: true }),
      ),
    ).toBe(false);
  });
});

describe("resolveProfileVisibility", () => {
  it("self and PUBLIC are full", () => {
    expect(
      resolveProfileVisibility(
        ProfileAccess.PRIVATE,
        relation({ isSelf: true }),
      ),
    ).toBe("full");
    expect(resolveProfileVisibility(ProfileAccess.PUBLIC, relation())).toBe(
      "full",
    );
  });

  it("PRIVATE stranger is locked, approved follower is full", () => {
    expect(resolveProfileVisibility(ProfileAccess.PRIVATE, relation())).toBe(
      "locked",
    );
    expect(
      resolveProfileVisibility(
        ProfileAccess.PRIVATE,
        relation({ following: true }),
      ),
    ).toBe("full");
  });

  it("GHOST and blocks are hidden (never locked)", () => {
    expect(resolveProfileVisibility(ProfileAccess.GHOST, relation())).toBe(
      "hidden",
    );
    expect(
      resolveProfileVisibility(
        ProfileAccess.PRIVATE,
        relation({ blockedByTarget: true }),
      ),
    ).toBe("hidden");
    expect(
      resolveProfileVisibility(
        ProfileAccess.PUBLIC,
        relation({ blocking: true }),
      ),
    ).toBe("hidden");
  });
});

describe("resolveFacet", () => {
  it("self sees everything, blocked sees nothing", () => {
    expect(
      resolveFacet(
        ProfileAccess.PRIVATE,
        VisibilityAudience.NONE,
        relation({ isSelf: true }),
      ),
    ).toBe(true);
    expect(
      resolveFacet(
        ProfileAccess.PUBLIC,
        VisibilityAudience.PUBLIC,
        relation({ blocking: true }),
      ),
    ).toBe(false);
  });

  it("NONE hides, FRIENDS needs friendship", () => {
    expect(
      resolveFacet(
        ProfileAccess.PUBLIC,
        VisibilityAudience.NONE,
        relation({ isFriend: true }),
      ),
    ).toBe(false);
    expect(
      resolveFacet(
        ProfileAccess.PUBLIC,
        VisibilityAudience.FRIENDS,
        relation({ isFriend: true }),
      ),
    ).toBe(true);
    expect(
      resolveFacet(
        ProfileAccess.PUBLIC,
        VisibilityAudience.FRIENDS,
        relation(),
      ),
    ).toBe(false);
  });

  it("PUBLIC setting is visible to any viewer on a PUBLIC profile", () => {
    expect(
      resolveFacet(ProfileAccess.PUBLIC, VisibilityAudience.PUBLIC, relation()),
    ).toBe(true);
  });

  it("a PRIVATE profile caps a PUBLIC setting down to FRIENDS", () => {
    // Non-friend viewer: capped PUBLIC→FRIENDS means hidden.
    expect(
      resolveFacet(
        ProfileAccess.PRIVATE,
        VisibilityAudience.PUBLIC,
        relation(),
      ),
    ).toBe(false);
    // Friend viewer: allowed.
    expect(
      resolveFacet(
        ProfileAccess.PRIVATE,
        VisibilityAudience.PUBLIC,
        relation({ isFriend: true }),
      ),
    ).toBe(true);
  });

  it("GHOST hides every facet", () => {
    expect(
      resolveFacet(
        ProfileAccess.GHOST,
        VisibilityAudience.PUBLIC,
        relation({ isFriend: true }),
      ),
    ).toBe(false);
  });
});
