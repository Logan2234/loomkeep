import { ratingLabel } from "#lib/chat/attachments.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MessageDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatMessageItem from "./ChatMessageItem.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const MINE: MessageDto = {
  id: "m1",
  conversationId: "cv1",
  authorId: "me",
  mine: true,
  text: "Carrément, 21h !",
  spoiler: false,
  edited: false,
  deleted: false,
  deletedByAdmin: false,
  reactions: [],
  myReaction: null,
  works: [],
  review: null,
  list: null,
  gone: null,
  pinned: false,
  forwarded: false,
  createdAt: "2026-10-09T21:14:00.000Z",
  updatedAt: "2026-10-09T21:14:00.000Z",
};

let deleted = false;
let pinned: string | null = null;
let unreadFrom: string | null = null;

beforeEach(() => {
  deleted = false;
  pinned = null;
  unreadFrom = null;
  layout.compact = false;
  server.use(
    http.delete(apiUrl("/chat/messages/m1"), () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.put(apiUrl("/chat/messages/:id/pin"), ({ params }) => {
      pinned = params.id as string;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(apiUrl("/chat/messages/:id/unread"), ({ params }) => {
      unreadFrom = params.id as string;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  layout.compact = true;
});

function renderMessage(message: MessageDto = MINE, onmarkedunread = vi.fn()) {
  renderWithQuery(ChatMessageItem, {
    message,
    onmarkedunread,
    writable: true,
    endOfGroup: true,
    time: "21:14",
    onedit: vi.fn(),
    onreport: vi.fn(),
  });
}

describe("ChatMessageItem", () => {
  it("confirms a deletion inside the message's menu", async () => {
    const user = userEvent.setup();
    renderMessage();

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.chat_delete_ellipsis() }),
    );
    expect(screen.getByText(m.chat_delete_confirm())).toBeTruthy();
    await user.click(screen.getByRole("button", { name: m.common_delete() }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("pins a message, and marks the other's unread from there", async () => {
    const user = userEvent.setup();
    const onmarkedunread = vi.fn();
    renderMessage(
      { ...MINE, id: "m2", mine: false, authorId: "lea" },
      onmarkedunread,
    );

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(screen.getByRole("menuitem", { name: m.chat_pin() }));
    await waitFor(() => expect(pinned).toBe("m2"));

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.chat_mark_unread() }),
    );
    await waitFor(() => expect(unreadFrom).toBe("m2"));
    await waitFor(() => expect(onmarkedunread).toHaveBeenCalled());
  });

  // A pin shows on the message itself, not only in the header's list.
  it("marks a pinned message on its bubble", () => {
    renderMessage({ ...MINE, pinned: true });

    expect(screen.getByRole("img", { name: m.chat_pinned() })).toBeTruthy();
  });

  it("says a forwarded message was forwarded", () => {
    renderMessage({ ...MINE, forwarded: true });

    expect(screen.getByText(m.chat_forwarded())).toBeTruthy();
  });

  // A phone has no hover: a long press opens the same actions in a sheet.
  it("quotes a review, behind a wall when it spoils", async () => {
    const user = userEvent.setup();
    renderMessage({
      ...MINE,
      mine: false,
      text: null,
      review: {
        rating: 9.5,
        text: "Le moment où la boucle s'explique.",
        spoiler: true,
        target: {
          title: "Outer Wilds",
          imageUrl: null,
          href: "/app/games/11737",
        },
      },
    });

    expect(screen.queryByText(/la boucle/)).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.chat_review_rating({ rating: ratingLabel(9.5) }),
      }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: m.chat_review_spoiler() }),
    );

    expect(screen.getByText(/la boucle/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Outer Wilds" }).getAttribute("href"),
    ).toBe("/app/games/11737");
  });

  it("shows a list's first works, the rest counted", () => {
    renderMessage({
      ...MINE,
      text: null,
      list: {
        id: "l1",
        title: "Octobre qui fait peur",
        kind: "RANKED",
        visibility: "FRIENDS",
        itemCount: 13,
        works: ["Hérédité", "The Thing", "Get Out", "Midsommar", "Alien"].map(
          (title) => ({ title, imageUrl: null }),
        ),
        ownerName: "Moi",
        mine: true,
        updatedAt: "2026-10-08T10:00:00.000Z",
      },
    });

    const card = screen.getByRole("link", { name: /Octobre qui fait peur/ });
    expect(card.getAttribute("href")).toBe("/app/lists/l1");
    expect(card.textContent).toContain("+9");
    expect(card.textContent).toContain(m.chat_list_by_you());
  });

  it("says when the list it carried is out of sight", () => {
    renderMessage({ ...MINE, text: null, gone: "list" });

    expect(screen.getByText(m.chat_list_gone())).toBeTruthy();
  });

  it("opens the actions on a long press on a phone", async () => {
    layout.compact = true;
    renderMessage();

    expect(
      screen.queryByRole("button", { name: m.common_more_actions() }),
    ).toBe(null);
    await fireEvent.pointerDown(screen.getByText("Carrément, 21h !"), {
      pointerType: "touch",
    });

    expect(
      await screen.findByRole("menuitem", { name: m.common_edit() }),
    ).toBeTruthy();
  });
});
