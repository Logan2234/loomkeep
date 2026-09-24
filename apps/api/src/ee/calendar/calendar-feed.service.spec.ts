import { vi } from "vitest";
import type { EntitlementService } from "../../entitlements/entitlement.service";
import type { LibraryService } from "../../library/library.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { CalendarFeedService } from "./calendar-feed.service";

function makeService(
  user: { id: string; calendarToken?: string | null } | null,
  hasPremium: boolean,
) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findUniqueOrThrow: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({ calendarToken: "fresh-token" }),
    },
  } as unknown as PrismaService;
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
  } as unknown as EntitlementService;
  const library = {
    getCalendar: vi.fn().mockResolvedValue([]),
  } as unknown as LibraryService;

  return {
    service: new CalendarFeedService(prisma, entitlements, library),
    prisma,
  };
}

describe("CalendarFeedService.getCalendarIcs", () => {
  it("returns the feed for a premium user with a valid token", async () => {
    const { service } = makeService({ id: "user-1" }, true);
    await expect(service.getCalendarIcs("tok")).resolves.not.toBeNull();
  });

  it("returns null for a non-premium user, even with a valid token", async () => {
    const { service } = makeService({ id: "user-1" }, false);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });

  it("returns null when the token matches no account", async () => {
    const { service } = makeService(null, true);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });
});

describe("CalendarFeedService tokens", () => {
  it("keeps an existing token rather than revoking the shared link", async () => {
    const { service, prisma } = makeService(
      { id: "user-1", calendarToken: "shared-token" },
      true,
    );

    await expect(service.getToken("user-1")).resolves.toEqual({
      token: "shared-token",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("issues a token on first use", async () => {
    const { service } = makeService(
      { id: "user-1", calendarToken: null },
      true,
    );

    await expect(service.getToken("user-1")).resolves.toEqual({
      token: "fresh-token",
    });
  });

  it("refuses a non-premium account", async () => {
    const { service } = makeService({ id: "user-1" }, false);

    await expect(service.regenerateToken("user-1")).rejects.toMatchObject({
      status: 403,
    });
  });
});
