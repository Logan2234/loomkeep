import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import type { WorkThreadDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatWorkRow from "./ChatWorkRow.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const THREAD: WorkThreadDto = {
  targetType: "MEDIA",
  targetId: "mi1",
  title: "Severance",
  kind: "SERIES",
  seasonNumber: null,
  episodeNumber: null,
  imageUrl: null,
  href: "/app/media/series/95396",
  unread: 3,
  muted: false,
  pinned: false,
  lastReadAt: null,
  canParticipate: true,
  lastActivityAt: "2026-10-09T20:00:00.000Z",
  lastComment: null,
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
    http.post(apiUrl("/chat/works/MEDIA/mi1/read"), record("read")),
    http.put(apiUrl("/chat/works/MEDIA/mi1/mute"), record("mute")),
    http.put(apiUrl("/chat/works/MEDIA/mi1/pin"), record("pin")),
    http.post(apiUrl("/chat/works/MEDIA/mi1/unfollow"), record("unfollow")),
  );
});

async function longPress() {
  await fireEvent.pointerDown(screen.getByText("Severance"), {
    pointerType: "touch",
  });
  return screen.findByRole("menu");
}

describe("ChatWorkRow", () => {
  it("opens the discussion's actions on a long press on a phone", async () => {
    renderWithQuery(ChatWorkRow, { thread: THREAD, onselect: vi.fn() });

    await longPress();

    for (const name of [
      m.chat_mark_read(),
      m.chat_mute(),
      m.chat_pin(),
      m.chat_work_go_to(),
      m.chat_work_unfollow(),
    ]) {
      expect(screen.getByRole("menuitem", { name })).toBeTruthy();
    }

    expect(
      screen
        .getByRole("menuitem", { name: m.chat_work_go_to() })
        .getAttribute("href"),
    ).toBe("/app/media/series/95396");
  });

  it("marks read, mutes, pins and unfollows from the sheet", async () => {
    const user = userEvent.setup();
    renderWithQuery(ChatWorkRow, { thread: THREAD, onselect: vi.fn() });

    for (const name of [
      m.chat_mark_read(),
      m.chat_mute(),
      m.chat_pin(),
      m.chat_work_unfollow(),
    ]) {
      await longPress();
      await user.click(screen.getByRole("menuitem", { name }));
    }

    await waitFor(() =>
      expect(calls).toEqual([
        "read",
        'mute {"muted":true}',
        'pin {"pinned":true}',
        "unfollow",
      ]),
    );
    await waitFor(() =>
      expect(toast.items.at(-1)?.message).toBe(m.chat_work_unfollowed()),
    );
  });

  it("shows a pinned discussion as pinned, and offers to unpin it", async () => {
    renderWithQuery(ChatWorkRow, {
      thread: { ...THREAD, pinned: true, unread: 0 },
      onselect: vi.fn(),
    });

    expect(screen.getByRole("img", { name: m.chat_pinned() })).toBeTruthy();
    await longPress();

    expect(screen.getByRole("menuitem", { name: m.chat_unpin() })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: m.chat_mark_read() })).toBe(
      null,
    );
  });
});
