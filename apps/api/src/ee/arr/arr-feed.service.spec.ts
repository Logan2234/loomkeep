import { vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CalendarFeedService } from "../calendar/calendar-feed.service";
import { ArrFeedService } from "./arr-feed.service";

function makeService(user: { id: string } | null) {
  const prisma = {
    mediaEntry: { findMany: vi.fn().mockResolvedValue([]) },
    list: { findFirst: vi.fn().mockResolvedValue(null) },
    mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const calendarFeed = {
    premiumUserForToken: vi.fn().mockResolvedValue(user),
  };
  return {
    service: new ArrFeedService(
      prisma as unknown as PrismaService,
      calendarFeed as unknown as CalendarFeedService,
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
