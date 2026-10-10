import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import QueryHarness from "#lib/test/QueryHarness.svelte";
import { renderWithQuery } from "#lib/test/render.js";
import type { ConversationDto, MessageDto } from "@loomkeep/shared";
import { render, screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatThread from "./ChatThread.svelte";

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

let reads = 0;

beforeEach(() => {
  reads = 0;
  layout.compact = false;
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
    http.post(apiUrl("/chat/conversations/cv1/read"), () => {
      reads += 1;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(apiUrl("/chat/unread"), () =>
      HttpResponse.json({ count: 0, works: 0 }),
    ),
  );
});

describe("ChatThread", () => {
  it('drops the "new" line once the conversation was read and reopened', async () => {
    const props = { conversationId: "cv1", mode: "panel" as const };
    const first = renderWithQuery(ChatThread, props);

    expect(
      await screen.findByRole("separator", { name: m.chat_unread_from_here() }),
    ).toBeTruthy();
    await waitFor(() => expect(reads).toBe(1));
    first.unmount();

    render(QueryHarness, {
      props: { client: first.client, component: ChatThread, props },
    });

    await screen.findByText("Message m2");
    await waitFor(() => expect(reads).toBe(2));
    expect(
      screen.queryByRole("separator", { name: m.chat_unread_from_here() }),
    ).toBe(null);
  });

  // Marked unread, left and reopened: it reads again, from the line.
  it("reads a conversation marked unread once it's reopened", async () => {
    const mine = { ...message("m3", "2026-10-09T22:00:00.000Z"), mine: true };
    server.use(
      http.get(apiUrl("/chat/conversations/cv1"), () =>
        HttpResponse.json({
          ...CONVERSATION,
          lastMessage: mine,
          unread: 0,
          lastReadAt: mine.createdAt,
        }),
      ),
      http.get(apiUrl("/chat/conversations/cv1/messages"), () =>
        HttpResponse.json({
          items: [mine, ...[...MESSAGES].reverse()],
          hasMore: false,
        }),
      ),
      http.post(
        apiUrl("/chat/messages/m2/unread"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const user = userEvent.setup();
    const props = { conversationId: "cv1", mode: "panel" as const };
    const first = renderWithQuery(ChatThread, props);

    await screen.findByText("Message m2");
    const bubble = screen
      .getByText("Message m2")
      .closest<HTMLElement>("[data-message-id]")!;
    await user.click(
      within(bubble).getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.chat_mark_unread() }),
    );
    await screen.findByRole("separator", { name: m.chat_unread_from_here() });
    expect(reads).toBe(0);
    first.unmount();

    render(QueryHarness, {
      props: { client: first.client, component: ChatThread, props },
    });

    expect(
      await screen.findByRole("separator", { name: m.chat_unread_from_here() }),
    ).toBeTruthy();
    await waitFor(() => expect(reads).toBe(1));
  });
});
