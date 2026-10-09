import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import ChatSearchBar from "./ChatSearchBar.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
}));

const FOUND = {
  id: "m7",
  conversationId: "cv1",
  authorId: "lea",
  mine: false,
  text: "Helly reste, **forcément**",
  spoiler: false,
  edited: false,
  deleted: false,
  deletedByAdmin: false,
  reactions: [],
  myReaction: null,
  works: [],
  pinned: false,
  forwarded: false,
  createdAt: "2026-10-07T10:00:00.000Z",
  updatedAt: "2026-10-07T10:00:00.000Z",
} satisfies MessageDto;

describe("ChatSearchBar", () => {
  it("searches the conversation and hands back the message picked", async () => {
    let asked = "";
    server.use(
      http.get(apiUrl("/chat/conversations/cv1/search"), ({ request }) => {
        asked = new URL(request.url).searchParams.get("q") ?? "";
        return HttpResponse.json([FOUND]);
      }),
    );
    const onpick = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(ChatSearchBar, {
      conversationId: "cv1",
      peerName: "Léa",
      onpick,
      onclose: vi.fn(),
    });

    await user.type(
      screen.getByRole("textbox", { name: m.chat_search_messages() }),
      "helly",
    );
    await user.click(
      await screen.findByRole("button", { name: /Helly reste, forcément/ }),
    );

    expect(asked).toBe("helly");
    expect(onpick).toHaveBeenCalledWith("m7");
  });
});
