import { vi } from "vitest";
import { CalendarFeedService } from "./calendar/calendar-feed.service";
import { ActivityFeedService } from "./social/activity-feed.service";

describe("feed links with a trailing slash in WEB_ORIGIN", () => {
  const user = {
    id: "viewer",
    username: "reader",
    locale: "en",
    profileAccess: "PUBLIC",
  };
  const config = {
    get: vi.fn(() => " https://example.com/, https://second.example/ "),
  };
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(true),
  };

  it("builds calendar release links from the first normalized origin", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      episode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "episode",
            number: 2,
            title: null,
            airDate: new Date(),
            season: {
              number: 1,
              mediaItem: {
                title: "Show",
                type: "SERIES",
                canonicalSource: "TMDB",
                externalIds: [{ source: "TMDB", externalId: "123" }],
              },
            },
          },
        ]),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const feed = await new CalendarFeedService(
      prisma as never,
      entitlements as never,
      null!,
      config as never,
    ).getReleasesFeed("token");
    expect(feed?.entries[0].link).toBe(
      "https://example.com/app/media/series/123",
    );
  });

  it("builds activity profile and entry links without double slashes", async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user) } };
    const activity = {
      profileTimeline: vi.fn().mockResolvedValue({
        items: [
          {
            id: "event",
            type: "ADDED",
            title: "Book",
            data: {},
            href: "/app/books/work",
            count: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    };
    const feed = await new ActivityFeedService(
      prisma as never,
      entitlements as never,
      activity as never,
      config as never,
    ).getFeed("token");
    expect(feed?.link).toBe("https://example.com/app/u/reader");
    expect(feed?.entries[0].link).toBe("https://example.com/app/books/work");
  });
});
