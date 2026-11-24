import { vi } from "vitest";
import { ActivityFeedService } from "./activity-feed.service";

describe("ActivityFeedService tokens", () => {
  function setup(existing: string | null) {
    const prisma = {
      userUrlToken: {
        findUnique: vi.fn().mockResolvedValue({ activityFeedToken: existing }),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    const entitlements = {
      isEffectivelyPremium: vi.fn().mockResolvedValue(true),
    };
    return {
      prisma,
      service: new ActivityFeedService(
        prisma as never,
        entitlements as never,
        null!,
        null!,
      ),
    };
  }

  it("keeps an existing feed subscription token", async () => {
    const { service, prisma } = setup("existing-token");
    await expect(service.getToken("viewer")).resolves.toEqual({
      token: "existing-token",
    });
    expect(prisma.userUrlToken.upsert).not.toHaveBeenCalled();
  });
  it("persists and returns the newly generated base64url token", async () => {
    const { service, prisma } = setup(null);
    const { token } = await service.getToken("viewer");
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(prisma.userUrlToken.upsert).toHaveBeenCalledWith({
      where: { userId: "viewer" },
      create: { userId: "viewer", activityFeedToken: token },
      update: { activityFeedToken: token },
    });
  });
  it("rotates the stored token when explicitly regenerated", async () => {
    const { service, prisma } = setup("old-token");
    const { token } = await service.regenerateToken("viewer");
    expect(token).not.toBe("old-token");
    expect(prisma.userUrlToken.upsert).toHaveBeenCalledWith({
      where: { userId: "viewer" },
      create: { userId: "viewer", activityFeedToken: token },
      update: { activityFeedToken: token },
    });
  });
});
