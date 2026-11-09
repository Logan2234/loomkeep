import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { ConversationDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatConversationRow from "./ChatConversationRow.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

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
  lastMessage: null,
  unread: 2,
  lastReadAt: "2026-10-09T20:30:00.000Z",
  muted: false,
  pinned: false,
  lastMessageAt: "2026-10-09T21:00:00.000Z",
};

let calls: string[] = [];

beforeEach(() => {
  calls = [];
  layout.compact = true;

  const record =
    (name: string) =>
    async ({ request }: { request: Request }) => {
      const body = request.method === "PUT" ? await request.json() : null;
      calls.push(body ? `${name} ${JSON.stringify(body)}` : name);
      return new HttpResponse(null, { status: 204 });
    };

  server.use(
    http.post(apiUrl("/chat/conversations/cv1/read"), record("read")),
    http.put(apiUrl("/chat/conversations/cv1/mute"), record("mute")),
    http.put(apiUrl("/chat/conversations/cv1/pin"), record("pin")),
    http.post(apiUrl("/chat/conversations/cv1/hide"), record("hide")),
  );
});

afterEach(() => {
  layout.compact = true;
});

async function longPress() {
  await fireEvent.pointerDown(screen.getByText("Léa"), {
    pointerType: "touch",
  });
  return screen.findByRole("menu");
}

function renderRow(conversation: ConversationDto = CONVERSATION) {
  const onselect = vi.fn();
  renderWithQuery(ChatConversationRow, { conversation, onselect });
  return onselect;
}

describe("ChatConversationRow", () => {
  it("opens the conversation's actions on a long press on a phone", async () => {
    renderRow();

    await longPress();

    for (const name of [
      m.chat_mark_read(),
      m.chat_mute(),
      m.chat_pin(),
      m.chat_view_profile(),
      m.chat_conversation_delete_ellipsis(),
    ]) {
      expect(screen.getByRole("menuitem", { name })).toBeTruthy();
    }

    expect(
      screen
        .getByRole("menuitem", { name: m.chat_view_profile() })
        .getAttribute("href"),
    ).toBe("/app/u/lea");
  });

  it("offers no long press on desktop", async () => {
    layout.compact = false;
    renderRow();

    await fireEvent.pointerDown(screen.getByText("Léa"), {
      pointerType: "touch",
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.queryByRole("menu")).toBe(null);
  });

  it("marks read, mutes and pins from the sheet", async () => {
    const user = userEvent.setup();
    renderRow();

    await longPress();
    await user.click(
      screen.getByRole("menuitem", { name: m.chat_mark_read() }),
    );
    await longPress();
    await user.click(screen.getByRole("menuitem", { name: m.chat_mute() }));
    await longPress();
    await user.click(screen.getByRole("menuitem", { name: m.chat_pin() }));

    await waitFor(() =>
      expect(calls).toEqual([
        "read",
        'mute {"muted":true}',
        'pin {"pinned":true}',
      ]),
    );
  });

  it("offers to unpin, unmute and nothing to read when there's nothing unread", async () => {
    renderRow({ ...CONVERSATION, unread: 0, muted: true, pinned: true });

    expect(screen.getByRole("img", { name: m.chat_pinned() })).toBeTruthy();
    expect(screen.getByRole("img", { name: m.chat_muted() })).toBeTruthy();
    await longPress();

    expect(screen.getByRole("menuitem", { name: m.chat_unpin() })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: m.chat_unmute() }),
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: m.chat_mark_read() })).toBe(
      null,
    );
  });

  it("removes the conversation from the list once confirmed", async () => {
    const user = userEvent.setup();
    renderRow();

    await longPress();
    await user.click(
      screen.getByRole("menuitem", {
        name: m.chat_conversation_delete_ellipsis(),
      }),
    );
    expect(screen.getByText(m.chat_conversation_delete_hint())).toBeTruthy();
    expect(calls).toEqual([]);
    await user.click(screen.getByRole("button", { name: m.common_delete() }));

    await waitFor(() => expect(calls).toEqual(["hide"]));
  });
});
