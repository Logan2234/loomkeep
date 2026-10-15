import { auth } from "#lib/auth.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { page, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import {
  ErrorCode,
  type NotificationDto,
  type UserDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
const realtime = vi.hoisted(() => new Map<string, () => void>());
vi.mock("#lib/realtime/socket.js", () => ({
  onRealtimeEvent: (event: string, handler: () => void) => {
    realtime.set(event, handler);
    return () => realtime.delete(event);
  },
}));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const entry = (
  id: string,
  over: Partial<NotificationDto> = {},
): NotificationDto => ({
  id,
  type: "FOLLOW",
  title: "Alice",
  body: null,
  url: "/app/u/alice",
  data: { actorUsername: "alice", actorDisplayName: "Alice" },
  timestamp: "2026-10-14T09:00:00Z",
  createdAt: "2026-10-14T09:00:00Z",
  readAt: null,
  ...over,
});

const alice = {
  id: "request",
  user: {
    id: "alice",
    username: "alice",
    displayName: "Alice",
    avatarUrl: null,
  },
  createdAt: "2026-10-04T00:00:00Z",
};

/** Answers the bell's reads; returns what it was asked to write. */
function serve({
  entries = [entry("n1")],
  counts = { unread: 1, unseen: 1 },
  requests = [] as (typeof alice)[],
} = {}) {
  const writes: string[] = [];

  const write = ({ request }: { request: Request }) => {
    writes.push(`${request.method} ${new URL(request.url).pathname}`);
    return new HttpResponse(null, { status: 204 });
  };

  let current = { ...counts };
  server.use(
    http.get(apiUrl("/notifications/counts"), () => HttpResponse.json(current)),
    http.get(apiUrl("/notifications/history"), () =>
      HttpResponse.json({ items: entries, hasMore: false }),
    ),
    http.get(apiUrl("/social/requests"), () => HttpResponse.json(requests)),
    http.post(apiUrl("/notifications/seen"), (info) => {
      current = { ...current, unseen: 0 };
      return write(info);
    }),
    http.post(apiUrl("/notifications/read"), write),
    http.patch(apiUrl("/notifications/:id/read"), write),
    http.patch(apiUrl("/notifications/:id/unread"), write),
    http.delete(apiUrl("/notifications/:id"), write),
  );
  return writes;
}

async function openBell() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: m.common_notifications() }),
  );
  return user;
}

beforeEach(() => {
  layout.compact = false;
  visit("/app");
});
afterEach(() => {
  for (const item of toast.items) toast.dismiss(item.id);
  auth.user = null;
  document.documentElement.classList.add("a11y-reduce-motion");
});

describe("the bell's badge", () => {
  it("counts what's new and the pending follow requests, and starts over once opened", async () => {
    const writes = serve({
      counts: { unread: 3, unseen: 2 },
      requests: [alice],
    });
    renderWithQuery(NotificationBell, {});
    const bell = screen.getByRole("button", { name: m.common_notifications() });

    await waitFor(() => expect(bell.textContent?.trim()).toBe("3"));
    await openBell();

    expect(writes).toContain("POST /api/notifications/seen");
    // The request still waits for an answer: it stays counted.
    await waitFor(() => expect(bell.textContent?.trim()).toBe("1"));
  });

  it("has no bell of its own in the compact shell, whose tab leads to the page", () => {
    layout.compact = true;
    serve();
    renderWithQuery(NotificationBell, {});

    expect(
      screen.queryByRole("button", { name: m.common_notifications() }),
    ).toBeNull();
  });
});

describe("a notification arriving", () => {
  const arrives = (unseen: number) => {
    server.use(
      http.get(apiUrl("/notifications/counts"), () =>
        HttpResponse.json({ unread: 2, unseen }),
      ),
      http.get(apiUrl("/notifications/history"), () =>
        HttpResponse.json({
          items: [
            entry("n2", {
              data: { actorUsername: "bob", actorDisplayName: "Bob" },
              createdAt: new Date().toISOString(),
            }),
            entry("n1"),
          ],
          hasMore: false,
        }),
      ),
    );
    realtime.get("notification")!();
  };

  it("lights the bell up while it's closed", async () => {
    serve({ counts: { unread: 1, unseen: 0 } });
    // The specs run without motion; the glow is what's under test here.
    document.documentElement.classList.remove("a11y-reduce-motion");
    const animate = vi.spyOn(Element.prototype, "animate");
    renderWithQuery(NotificationBell, {});
    const bell = screen.getByRole("button", { name: m.common_notifications() });
    await waitFor(() => expect(realtime.has("notification")).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));

    arrives(1);

    await waitFor(() => expect(bell.textContent?.trim()).toBe("1"));
    await waitFor(() => expect(animate.mock.contexts).toContain(bell));
    animate.mockRestore();
  });

  it("is seen at once when it lands in the open bell", async () => {
    const writes = serve();
    renderWithQuery(NotificationBell, {});
    await openBell();
    await screen.findByText("Alice");

    arrives(1);

    expect(await screen.findByText("Bob")).toBeTruthy();
    await waitFor(() =>
      expect(writes.filter((w) => w.endsWith("/seen"))).toHaveLength(2),
    );
  });
});

describe("an entry in the bell", () => {
  it("is marked read in place, not deleted", async () => {
    const writes = serve();
    renderWithQuery(NotificationBell, {});
    const user = await openBell();

    await user.click(
      await screen.findByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.notif_mark_read() }),
    );

    await waitFor(() =>
      expect(writes).toContain("PATCH /api/notifications/n1/read"),
    );
    expect(writes).not.toContain("DELETE /api/notifications/n1");
    expect(screen.getByText(m.notif_follow())).toBeTruthy();
  });

  it("is deleted only once the toast is gone, so Annuler brings it back", async () => {
    const writes = serve();
    renderWithQuery(NotificationBell, {});
    const user = await openBell();

    await user.click(
      await screen.findByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(screen.getByRole("menuitem", { name: m.common_delete() }));
    await waitFor(() =>
      expect(screen.queryByText(m.notif_follow())).toBeNull(),
    );

    const undo = toast.items.find((t) => t.message === m.notif_deleted());
    toast.selectAction(undo!.id);
    expect(await screen.findByText(m.notif_follow())).toBeTruthy();
    expect(writes).not.toContain("DELETE /api/notifications/n1");

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(screen.getByRole("menuitem", { name: m.common_delete() }));
    const again = toast.items.find((t) => t.message === m.notif_deleted());
    toast.dismiss(again!.id);
    await waitFor(() =>
      expect(writes).toContain("DELETE /api/notifications/n1"),
    );
  });

  it("offers to mark everything read only while something is unread", async () => {
    serve({
      entries: [entry("n1", { readAt: "2026-10-14T10:00:00Z" })],
      counts: { unread: 0, unseen: 0 },
    });
    renderWithQuery(NotificationBell, {});
    await openBell();
    await screen.findByText("Alice");

    expect(
      screen.queryByRole("button", { name: m.notif_mark_all_read() }),
    ).toBeNull();
  });

  it("can all be marked read at once", async () => {
    const writes = serve({
      entries: [entry("n1"), entry("n2", { readAt: "2026-10-14T10:00:00Z" })],
    });
    renderWithQuery(NotificationBell, {});
    const user = await openBell();

    await screen.findAllByText(m.notif_follow());
    await user.click(
      await screen.findByRole("button", { name: m.notif_mark_all_read() }),
    );

    await waitFor(() =>
      expect(writes).toContain("POST /api/notifications/read"),
    );
  });

  it("is read when its push is opened from the system tray", async () => {
    visit("/app/u/alice?notification=n7");
    const writes = serve();
    renderWithQuery(NotificationBell, {});

    await waitFor(() =>
      expect(writes).toContain("PATCH /api/notifications/n7/read"),
    );
    await waitFor(() =>
      expect(page.url.href).toBe("http://localhost/app/u/alice"),
    );
  });
});

describe("a notification leading to a domain the viewer turned off", () => {
  it("isn't a link, and says why", async () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    serve({
      entries: [
        entry("dune", {
          type: "COMMENT_REPLY",
          url: "/app/media/movie/1",
          data: {
            actorUsername: "bob",
            actorDisplayName: "Bob",
            workTitle: "Dune",
          },
        }),
        entry("bg3", {
          type: "COMMENT_REPLY",
          url: "/app/games/2",
          data: {
            actorUsername: "carol",
            actorDisplayName: "Carol",
            workTitle: "Baldur's Gate 3",
          },
        }),
      ],
    });
    renderWithQuery(NotificationBell, {});
    await openBell();
    await screen.findByText(
      m.notif_comment_reply({ work: "Baldur's Gate 3" }),
      {
        exact: false,
      },
    );

    expect(
      screen.getByRole("link", { name: /Dune/ }).getAttribute("href"),
    ).toBe("/app/media/movie/1");
    expect(screen.queryByRole("link", { name: /Baldur/ })).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.common_work_domain_off({ domain: m.common_Games() }),
      }),
    ).toBeTruthy();
  });
});

describe("follow request failures", () => {
  it.each(["accept", "reject"] as const)(
    "shows an error and allows retry after %s fails",
    async (action) => {
      let fail = true;
      serve({
        entries: [],
        counts: { unread: 0, unseen: 0 },
        requests: [alice],
      });
      server.use(
        http.post(apiUrl(`/social/requests/request/${action}`), () =>
          fail
            ? HttpResponse.json(
                { code: ErrorCode.InternalError },
                { status: 500 },
              )
            : new HttpResponse(null, { status: 204 }),
        ),
      );
      renderWithQuery(NotificationBell, {});
      const user = await openBell();
      const dialog = await screen.findByRole("dialog");
      const button = await within(dialog).findByRole("button", {
        name: action === "accept" ? m.common_accept() : m.common_reject(),
      });

      await user.click(button);
      await waitFor(() =>
        expect(toast.items.some((item) => item.variant === "error")).toBe(true),
      );
      expect(within(dialog).getByText("Alice")).toBeTruthy();
      await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));

      fail = false;
      await user.click(button);

      if (action === "accept") {
        expect(
          await within(dialog).findByText(
            m.notif_follows_you_now({ name: "Alice" }),
          ),
        ).toBeTruthy();
      } else {
        await waitFor(() =>
          expect(within(dialog).queryByText("Alice")).toBeNull(),
        );
      }
    },
  );
});
