import { describe, expect, it } from "vitest";
import { queryClient } from "../api/query-client";
import { chat, chatDrafts } from "../chat/chat.svelte";
import { auth } from "./auth.svelte";

describe("auth.clear", () => {
  it("drops the cached queries, so the next account in this tab never sees the previous one's data", () => {
    queryClient.setQueryData(["library", "list"], { items: ["previous"] });

    auth.clear();

    expect(queryClient.getQueryData(["library", "list"])).toBeUndefined();
    expect(auth.user).toBeNull();
  });

  it("closes Messages and forgets its drafts, so the next account doesn't open the previous one's conversation", () => {
    chat.show("conversation-1");
    chatDrafts.set("conversation-1", "unsent text");

    auth.clear();

    expect(chat.open).toBe(false);
    expect(chat.activeId).toBeNull();
    expect(chatDrafts.size).toBe(0);
  });
});
