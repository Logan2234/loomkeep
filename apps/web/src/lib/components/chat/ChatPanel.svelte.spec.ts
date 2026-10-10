import { chat } from "#lib/chat/chat.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { ConversationDto, MessageDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "./ChatPanel.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
vi.mock("#lib/realtime/socket.js", () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  onRealtimeEvent: () => () => {},
}));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
}));

const message = (id: string, at: string): MessageDto => ({
  id,
  conversationId: "cv1",
  authorId: "lea",
  mine: false,
  text: `Message ${id}`,
  spoiler: false,
  edited: false,
  deleted: false,
  deletedByAdmin: false,
  reactions: [],
  myReaction: null,
  works: [],
  pinned: false,
  forwarded: false,
  createdAt: at,
  updatedAt: at,
});

const MESSAGES = [
  message("m1", "2026-10-09T20:00:00.000Z"),
  message("m2", "2026-10-09T21:00:00.000Z"),
];

const CONVERSATION: ConversationDto = {
  id: "cv1",
  peer: {
    id: "lea",
    username: "lea",
    displayName: "Léa",
    avatarUrl: null,
    profileAccess: "PUBLIC",
  },
  readOnly: null,
  peerOnline: null,
  peerLastReadAt: null,
  lastMessage: MESSAGES[1],
  unread: 1,
  lastReadAt: "2026-10-09T20:30:00.000Z",
  muted: false,
  lastMessageAt: MESSAGES[1].createdAt,
};

beforeEach(() => {
  server.use(
    http.get(apiUrl("/chat/conversations/cv1"), () =>
      HttpResponse.json(CONVERSATION),
    ),
    http.get(apiUrl("/chat/conversations/cv1/messages"), () =>
      HttpResponse.json({ items: [...MESSAGES].reverse(), hasMore: false }),
    ),
    http.get(apiUrl("/chat/conversations/cv1/pins"), () =>
      HttpResponse.json([]),
    ),
    http.post(
      apiUrl("/chat/conversations/cv1/read"),
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.get(apiUrl("/chat/conversations"), () =>
      HttpResponse.json({ items: [CONVERSATION], hasMore: false }),
    ),
    http.get(apiUrl("/chat/works"), () => HttpResponse.json([])),
    http.get(apiUrl("/chat/unread"), () =>
      HttpResponse.json({ count: 0, works: 0 }),
    ),
  );
});

afterEach(() => {
  chat.close();
  chat.activeId = null;
});

describe("ChatPanel", () => {
  it("lets Escape close an open menu without closing the panel", async () => {
    chat.show("cv1");
    const user = userEvent.setup();
    renderWithQuery(ChatPanel, {});

    await screen.findByText("Message m2");
    await user.click(
      screen.getAllByRole("button", { name: m.common_more_actions() })[0],
    );
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);

    await user.keyboard("{Escape}");

    expect(screen.queryAllByRole("menuitem")).toEqual([]);
    expect(chat.open).toBe(true);
  });
});
