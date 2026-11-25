import { vi } from "vitest";
import type { EntitlementService } from "../../entitlements/entitlement.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { ArrFeedService } from "./arr-feed.service";

function makeService(user: { id: string } | null, premium = true) {
  const prisma = {
    userUrlToken: {
      findUnique: vi.fn().mockResolvedValue(user ? { userId: user.id } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    mediaEntry: { findMany: vi.fn().mockResolvedValue([]) },
    list: { findFirst: vi.fn().mockResolvedValue(null) },
    mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(premium),
  };
  return {
    service: new ArrFeedService(
      prisma as unknown as PrismaService,
      entitlements as unknown as EntitlementService,
    ),
    prisma,
  };
}

describe("ArrFeedService", () => {
  it("serves nothing for a token that isn't a premium member's", async () => {
    const { service, prisma } = makeService(null);

    expect(await service.pile("tok")).toBeNull();
    expect(await service.list("tok", "list-1")).toBeNull();
    expect(prisma.mediaEntry.findMany).not.toHaveBeenCalled();
  });

  it("serves nothing once the token's owner is no longer premium", async () => {
    const { service, prisma } = makeService({ id: "alice" }, false);

    expect(await service.pile("tok")).toBeNull();
    expect(prisma.mediaEntry.findMany).not.toHaveBeenCalled();
  });

  it("opens only with the arr token, not the calendar's", async () => {
    const { service, prisma } = makeService({ id: "alice" });

    await service.pile("tok");

    expect(prisma.userUrlToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { arrToken: "tok" } }),
    );
  });

  it("regenerates its own token and leaves the calendar's alone", async () => {
    const { service, prisma } = makeService({ id: "alice" });

    const { token } = await service.regenerateToken("alice");

    expect(prisma.userUrlToken.upsert).toHaveBeenCalledWith({
      where: { userId: "alice" },
      create: { userId: "alice", arrToken: token },
      update: { arrToken: token },
    });
  });

  it("reads only the token owner's own lists", async () => {
    const { service, prisma } = makeService({ id: "alice" });

    expect(await service.list("tok", "bobs-list")).toBeNull();
    expect(prisma.list.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bobs-list", userId: "alice" } }),
    );
  });

  it("keeps the list's order and its films and series only", async () => {
    const { service, prisma } = makeService({ id: "alice" });
    prisma.list.findFirst.mockResolvedValue({
      items: [{ targetId: "b" }, { targetId: "a" }],
    });
    prisma.mediaItem.findMany.mockResolvedValue([
      { id: "a", title: "A", type: "MOVIE", externalIds: [] },
      { id: "b", title: "B", type: "SERIES", externalIds: [] },
    ]);

    const items = await service.list("tok", "list-1");

    expect(items?.map((i) => i.title)).toEqual(["B", "A"]);
    expect(prisma.list.findFirst.mock.calls[0][0].select.items.where).toEqual({
      targetType: "MEDIA",
    });
  });

  it("feeds the pile's titles still to watch", async () => {
    const { service, prisma } = makeService({ id: "alice" });

    await service.pile("tok");

    expect(prisma.mediaEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "alice", status: "PLANNED" },
      }),
    );
  });
});
