import type { ActivityEventDto } from "@loomkeep/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const event = (id: string, domain: string, createdAt: string) =>
  ({ id, domain, createdAt }) as ActivityEventDto;

// The feed page's first page: a friend's game, then their book.
const { getFeedMock } = vi.hoisted(() => ({ getFeedMock: vi.fn() }));
vi.mock("$lib/api/client", () => ({ getFeed: getFeedMock }));

describe("loadActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeedMock.mockImplementation((_page: number, domain?: string) =>
      Promise.resolve({
        items: [
          event("game", "GAMES", "2026-09-24T20:00:00Z"),
          event("book", "BOOKS", "2026-09-24T18:00:00Z"),
        ].filter((e) => !domain || e.domain === domain),
        hasMore: false,
      }),
    );
  });

  it("shows every domain the feed page shows", async () => {
    const events = await loadActivity(null);

    expect(events.map((e) => e.id)).toEqual(["game", "book"]);
  });

  it("merges the picked domains newest first", async () => {
    const events = await loadActivity(["BOOKS", "GAMES"]);

    expect(events.map((e) => e.id)).toEqual(["game", "book"]);
  });
});

const { loadActivity } = await import("./activity");
