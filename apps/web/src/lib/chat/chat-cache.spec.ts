import type { ConversationDto, MessageDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  applyToConversations,
  chronological,
  seenMessageId,
  upsertMessage,
  type MessagePages,
} from "./chat-cache";

function message(id: string, at: string, over: Partial<MessageDto> = {}) {
  return {
    id,
    conversationId: "cv1",
    authorId: "lea",
    mine: false,
    text: id,
    spoiler: false,
    edited: false,
    deleted: false,
    deletedByAdmin: false,
    reactions: [],
    myReaction: null,
    works: [],
    pinned: false,
    forwarded: false,
    createdAt: `2026-10-06T${at}:00.000Z`,
    updatedAt: `2026-10-06T${at}:00.000Z`,
    ...over,
  } satisfies MessageDto;
}

function pages(...ids: MessageDto[][]): MessagePages {
  return {
    pages: ids.map((items) => ({ items, hasMore: false })),
    pageParams: ids.map((_, i) => i + 1),
  };
}

describe("upsertMessage", () => {
  it("puts a new message on top of the newest page", () => {
    const data = upsertMessage(
      pages([message("m2", "21:31")]),
      message("m3", "21:32"),
    );
    expect(data?.pages[0].items.map((m) => m.id)).toEqual(["m3", "m2"]);
  });

  // The sender gets it twice: from the request's answer and from the socket.
  it("replaces a message already loaded rather than adding it again", () => {
    const data = upsertMessage(
      pages([message("m2", "21:31")]),
      message("m2", "21:31", { edited: true }),
    );
    expect(data?.pages[0].items).toHaveLength(1);
    expect(data?.pages[0].items[0].edited).toBe(true);
  });
});

describe("chronological", () => {
  // Offset pages shift when messages arrive between two fetches.
  it("reads oldest first and keeps each message once", () => {
    const shown = chronological([
      {
        items: [message("m3", "21:32"), message("m2", "21:31")],
        hasMore: true,
      },
      {
        items: [message("m2", "21:31"), message("m1", "21:30")],
        hasMore: false,
      },
    ]);
    expect(shown.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });
});

describe("applyToConversations", () => {
  const conversation = {
    id: "cv1",
    peer: null,
    readOnly: null,
    peerOnline: null,
    peerLastReadAt: null,
    lastMessage: message("m1", "21:30"),
    unread: 0,
    muted: false,
    lastMessageAt: "2026-10-06T21:30:00.000Z",
  } satisfies ConversationDto;
  const other = { ...conversation, id: "cv0" };

  it("moves the conversation up and counts an unread message from the other member", () => {
    const list = applyToConversations(
      { items: [other, conversation], hasMore: false },
      message("m2", "21:31"),
      false,
    );
    expect(list?.items.map((c) => c.id)).toEqual(["cv1", "cv0"]);
    expect(list?.items[0].unread).toBe(1);
    expect(list?.items[0].lastMessage?.id).toBe("m2");
  });

  it("counts nothing for the viewer's own message or one read on screen", () => {
    const list = { items: [conversation], hasMore: false };
    expect(
      applyToConversations(list, message("m2", "21:31", { mine: true }), false)
        ?.items[0].unread,
    ).toBe(0);
    expect(
      applyToConversations(list, message("m2", "21:31"), true)?.items[0].unread,
    ).toBe(0);
  });

  it("asks for a refetch when the conversation isn't listed yet", () => {
    expect(
      applyToConversations(
        { items: [other], hasMore: false },
        message("m2", "21:31"),
        false,
      ),
    ).toBeNull();
  });
});

describe("seenMessageId", () => {
  const thread = [
    message("m1", "21:30", { mine: true }),
    message("m2", "21:35"),
    message("m3", "21:41", { mine: true }),
  ];

  it("marks the viewer's last message once the other member read past it", () => {
    expect(seenMessageId(thread, "2026-10-06T21:43:00.000Z")).toBe("m3");
  });

  it("marks nothing while the last one is unread, or receipts are hidden", () => {
    expect(seenMessageId(thread, "2026-10-06T21:36:00.000Z")).toBeNull();
    expect(seenMessageId(thread, null)).toBeNull();
  });
});
