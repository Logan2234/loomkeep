import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CommentDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentThread from "./CommentThread.svelte";

vi.mock("#lib/realtime/socket.js", () => ({
  onRealtimeEvent: () => () => {},
}));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
}));

const comment = (id: string, authorId: string): CommentDto => ({
  id,
  targetType: "MEDIA",
  targetId: "m1",
  parentId: null,
  text: `Commentaire ${id}`,
  deleted: false,
  deletedByAdmin: false,
  edited: false,
  spoilerTag: false,
  masked: false,
  createdAt: "2026-10-09T20:00:00.000Z",
  updatedAt: "2026-10-09T20:00:00.000Z",
  author: {
    id: authorId,
    username: authorId,
    displayName: authorId.toUpperCase(),
    avatarUrl: null,
    profileAccess: "PUBLIC",
  },
  mentions: [],
  reactions: [],
  myReaction: null,
  replies: [],
  replyCount: 0,
});

afterEach(() => {
  auth.user = null;
});

describe("CommentThread", () => {
  // The same menu as a message in Messages: what's offered depends on whose
  // comment it is.
  it("offers each comment's actions in its menu", async () => {
    auth.user = { id: "me" } as UserDto;
    server.use(
      http.get(apiUrl("/comments/MEDIA/m1"), () =>
        HttpResponse.json({
          items: [comment("c1", "lea"), comment("c2", "me")],
          hasMore: false,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(CommentThread, {
      targetType: "MEDIA",
      targetId: "m1",
      canParticipate: true,
    });

    await screen.findByText("Commentaire c1");
    const [theirs, mine] = screen.getAllByRole("button", {
      name: m.common_more_actions(),
    });

    await user.click(theirs);
    const items = () =>
      screen.getAllByRole("menuitem").map((item) => item.textContent?.trim());
    expect(items()).toEqual([
      m.common_reply(),
      m.chat_copy_text(),
      m.common_report(),
    ]);

    await user.keyboard("{Escape}");
    await user.click(mine);
    expect(items()).toEqual([
      m.common_reply(),
      m.common_edit(),
      m.chat_copy_text(),
      m.chat_delete_ellipsis(),
    ]);
  });
});
