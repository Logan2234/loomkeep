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
  poll: null,
  saga: null,
  pick: null,
  where: false,
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
        id: "r1",
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
    expect(
      screen
        .getByRole("link", { name: m.chat_review_read_full() })
        .getAttribute("href"),
    ).toBe("/app/games/11737#review-r1");
  });

  it("shows a few emoji alone in large, out of the bubble", () => {
    renderMessage({ ...MINE, text: "🔥🔥" });

    const big = screen.getByText("🔥🔥").closest('[class*="text-[2.5rem]"]');
    expect(big).not.toBe(null);
    expect(big?.className).not.toContain("bg-accent/20");
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

  it("votes on a poll, and shows who voted what", async () => {
    let voted: unknown = null;
    server.use(
      http.put(apiUrl("/chat/messages/m1/vote"), async ({ request }) => {
        voted = await request.json();
        return HttpResponse.json(MINE);
      }),
    );
    const lea = {
      id: "lea",
      username: "lea",
      displayName: "Léa",
      avatarUrl: null,
      profileAccess: "PUBLIC" as const,
    };
    const user = userEvent.setup();
    renderMessage({
      ...MINE,
      text: null,
      poll: {
        question: "On regarde quoi ?",
        options: [
          {
            id: "o1",
            text: "Severance",
            href: "/app/media/series/95396",
            imageUrl: null,
            voters: [lea],
          },
          {
            id: "o2",
            text: "Un vieux Pixar",
            href: null,
            imageUrl: null,
            voters: [],
          },
        ],
        myVote: null,
      },
    });

    expect(
      screen.getByRole("button", { name: /Severance/ }).textContent,
    ).toContain("100%");
    await user.click(screen.getByRole("button", { name: /Un vieux Pixar/ }));

    await waitFor(() => expect(voted).toEqual({ option: "o2" }));
  });

  it("shows each member's progress through a shared saga", async () => {
    server.use(
      http.get(apiUrl("/chat/messages/m1/saga"), () =>
        HttpResponse.json({
          domain: "GAMES",
          title: "The Witcher",
          works: ["The Witcher", "The Witcher 2", "The Witcher 3"].map(
            (title, i) => ({
              title,
              imageUrl: null,
              href: `/app/games/${i + 1}`,
              upcoming: false,
            }),
          ),
          members: [
            {
              user: {
                id: "me",
                username: "me",
                displayName: "Moi",
                avatarUrl: null,
                profileAccess: "PUBLIC",
              },
              mine: true,
              steps: ["done", "done", "active"],
            },
          ],
        }),
      ),
    );
    renderMessage({
      ...MINE,
      text: null,
      saga: { domain: "GAMES", key: "IGDB:6" },
    });

    expect(await screen.findByText("The Witcher")).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: m.chat_saga_open({ title: "The Witcher 3" }),
        })
        .getAttribute("href"),
    ).toBe("/app/games/3");
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("says what a /pick was drawn among", () => {
    renderMessage({
      ...MINE,
      text: null,
      works: [
        {
          kind: "MOVIE",
          title: "Perfect Days",
          imageUrl: null,
          href: "/app/media/movie/976893",
          year: 2023,
          inLibrary: true,
        },
      ],
      pick: { domain: "MEDIA", shared: true, count: 3 },
    });

    expect(
      screen.getByText(m.chat_pick_shared_many({ count: 3 })),
    ).toBeTruthy();
    // The draw is its own card, not also a work card.
    expect(screen.getAllByRole("link", { name: /Perfect Days/ })).toHaveLength(
      1,
    );
  });

  it("lists where a work can be watched, with the members who have each platform", async () => {
    server.use(
      http.get(apiUrl("/chat/messages/m1/where"), () =>
        HttpResponse.json({
          region: "FR",
          offers: [
            {
              provider: { id: 381, name: "Canal+", logoUrl: null },
              kind: "flatrate",
              members: [
                {
                  id: "lea",
                  username: "lea",
                  displayName: "Léa",
                  avatarUrl: null,
                  profileAccess: "PUBLIC",
                },
              ],
            },
            {
              provider: { id: 119, name: "Prime Video", logoUrl: null },
              kind: "rent",
              members: [],
            },
          ],
          link: "https://www.themoviedb.org/movie/693134/watch?locale=FR",
        }),
      ),
    );
    renderMessage({
      ...MINE,
      text: null,
      works: [
        {
          kind: "MOVIE",
          title: "Dune : Deuxième partie",
          imageUrl: null,
          href: "/app/media/movie/693134",
          year: 2024,
          inLibrary: false,
        },
      ],
      where: true,
    });

    expect(await screen.findByText("Canal+")).toBeTruthy();
    expect(screen.getByText(m.media_rent())).toBeTruthy();
    expect(screen.getByTitle("Léa")).toBeTruthy();
    expect(
      screen.getByText(m.media_watch_attribution({ region: "FR" })),
    ).toBeTruthy();
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
