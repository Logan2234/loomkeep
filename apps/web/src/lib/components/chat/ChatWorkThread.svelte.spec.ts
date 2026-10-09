import { chat } from "#lib/chat/chat.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { WorkThreadDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ChatWorkThread from "./ChatWorkThread.svelte";

vi.mock("#lib/realtime/socket.js", () => ({
  joinRealtimeRoom: () => () => {},
  onRealtimeEvent: () => () => {},
}));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const THREAD: WorkThreadDto = {
  targetType: "EPISODE",
  targetId: "ep1",
  title: "Severance",
  kind: "SERIES",
  seasonNumber: 2,
  episodeNumber: 5,
  imageUrl: null,
  href: "/app/media/series/95396#s2e5",
  unread: 3,
  canParticipate: true,
  lastActivityAt: "2026-10-09T20:00:00.000Z",
  lastComment: null,
};

describe("ChatWorkThread", () => {
  it("names the work and its episode, and reads the discussion on opening", async () => {
    let read = 0;
    server.use(
      http.get(apiUrl("/chat/works/EPISODE/ep1"), () =>
        HttpResponse.json(THREAD),
      ),
      http.post(apiUrl("/chat/works/EPISODE/ep1/read"), () => {
        read += 1;
        return new HttpResponse(null, { status: 201 });
      }),
      http.get(apiUrl("/comments/EPISODE/ep1"), () =>
        HttpResponse.json({ items: [], hasMore: false }),
      ),
    );

    renderWithQuery(ChatWorkThread, {
      work: { targetType: "EPISODE", targetId: "ep1" },
      mode: "panel",
    });

    const link = await screen.findByRole("link", { name: "Severance" });
    expect(link.getAttribute("href")).toBe("/app/media/series/95396#s2e5");
    expect(screen.getByText("S02E05")).toBeTruthy();
    await waitFor(() => expect(read).toBe(1));
    expect(chat.workOnScreen).toBe("EPISODE:ep1");
  });
});
