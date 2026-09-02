import { ProfileAccess, type UserSummaryDto } from "@loomkeep/shared";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { fetchXpByUser, withXp } from "./xp-lookup.util";

function author(overrides: Partial<UserSummaryDto> = {}): UserSummaryDto {
  return {
    id: "u1",
    username: "logan",
    displayName: "Logan",
    profileAccess: ProfileAccess.PUBLIC,
    avatarUrl: null,
    ...overrides,
  };
}

describe("fetchXpByUser", () => {
  it("returns an empty map for an empty userIds list without querying", async () => {
    const prisma = {
      userScore: { findMany: vi.fn() },
    } as unknown as PrismaService;

    const result = await fetchXpByUser(prisma, []);

    expect(result.size).toBe(0);
    expect(prisma.userScore.findMany).not.toHaveBeenCalled();
  });

  it("defaults a user with no UserScore row to 0 xp", async () => {
    const prisma = {
      userScore: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const result = await fetchXpByUser(prisma, ["u1"]);

    expect(result.get("u1")).toBe(0);
  });

  it("maps each user to their UserScore.xp", async () => {
    const prisma = {
      userScore: {
        findMany: vi.fn().mockResolvedValue([
          { userId: "u1", xp: 120 },
          { userId: "u2", xp: 40 },
        ]),
      },
    } as unknown as PrismaService;

    const result = await fetchXpByUser(prisma, ["u1", "u2", "u3"]);

    expect(result.get("u1")).toBe(120);
    expect(result.get("u2")).toBe(40);
    expect(result.get("u3")).toBe(0);
  });
});

describe("withXp", () => {
  const xpByUser = new Map([["u1", 120]]);

  it("attaches xp when gamification is enabled and progression isn't hidden", () => {
    const hideProgressionByUser = new Map([["u1", false]]);

    const result = withXp(
      author(),
      "viewer",
      xpByUser,
      true,
      hideProgressionByUser,
    );

    expect(result.xp).toBe(120);
  });

  it("omits xp entirely when gamification is disabled", () => {
    const hideProgressionByUser = new Map([["u1", false]]);

    const result = withXp(
      author(),
      "viewer",
      xpByUser,
      false,
      hideProgressionByUser,
    );

    expect(result.xp).toBeUndefined();
  });

  it("omits xp for an anonymized (Figurant) author", () => {
    const hideProgressionByUser = new Map([["u1", false]]);

    const result = withXp(
      author({ anonymized: true }),
      "viewer",
      xpByUser,
      true,
      hideProgressionByUser,
    );

    expect(result.xp).toBeUndefined();
  });

  it("omits xp for another viewer when the author hid their progression", () => {
    const hideProgressionByUser = new Map([["u1", true]]);

    const result = withXp(
      author(),
      "viewer",
      xpByUser,
      true,
      hideProgressionByUser,
    );

    expect(result.xp).toBeUndefined();
  });

  it("still shows xp to the author themselves even when hideProgression is set", () => {
    const hideProgressionByUser = new Map([["u1", true]]);

    const result = withXp(
      author(),
      "u1",
      xpByUser,
      true,
      hideProgressionByUser,
    );

    expect(result.xp).toBe(120);
  });

  it("defaults to 0 xp for a user with no UserScore row", () => {
    const hideProgressionByUser = new Map([["u1", false]]);

    const result = withXp(
      author(),
      "viewer",
      new Map(),
      true,
      hideProgressionByUser,
    );

    expect(result.xp).toBe(0);
  });
});
