import { apiUrl, server } from "#lib/test/msw.js";
import type { ActivityEventDto } from "@loomkeep/shared/contracts";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadActivity } from "./activity";

const event = (id: string, domain: string, createdAt: string) =>
  ({ id, domain, createdAt }) as ActivityEventDto;

// The feed page's first page: a friend's game, then their book.
const FEED = [
  event("game", "GAMES", "2026-09-24T20:00:00Z"),
  event("book", "BOOKS", "2026-09-24T18:00:00Z"),
];

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("loadActivity", () => {
  const requested: (string | null)[] = [];

  beforeAll(() => {
    server.events.on("request:start", ({ request }) => {
      requested.push(new URL(request.url).searchParams.get("domain"));
    });
  });

  afterEach(() => {
    requested.length = 0;
  });

  const serveFeed = () =>
    server.use(
      http.get(apiUrl("/social/feed"), ({ request }) => {
        const url = new URL(request.url);
        const domain = url.searchParams.get("domain");
        return HttpResponse.json({
          items: FEED.filter((e) => !domain || e.domain === domain),
          hasMore: false,
        });
      }),
    );

  it("shows every domain the feed page shows", async () => {
    serveFeed();

    const events = await loadActivity(null);

    expect(events.map((e) => e.id)).toEqual(["game", "book"]);
    expect(requested).toEqual([null]);
  });

  it("merges the picked domains newest first", async () => {
    serveFeed();

    const events = await loadActivity(["BOOKS", "GAMES"]);

    expect(events.map((e) => e.id)).toEqual(["game", "book"]);
    expect(requested.sort()).toEqual(["BOOKS", "GAMES"]);
  });
});
