import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { page, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import { ErrorCode, type NotificationDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NotificationsPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const entry = (
  id: string,
  name: string,
  createdAt: string,
  readAt: string | null = null,
): NotificationDto => ({
  id,
  type: "FOLLOW",
  title: name,
  body: null,
  url: `/app/u/${id}`,
  data: { actorUsername: id, actorDisplayName: name },
  timestamp: createdAt,
  createdAt,
  readAt,
});

const fresh = entry("alice", "Alice", new Date().toISOString());
const old = entry("bob", "Bob", hoursAgo(24 * 30), hoursAgo(24 * 29));

/** Serves the history (filtered like the API); returns the writes made. */
function serve(entries: NotificationDto[]) {
  const writes: string[] = [];

  const write = ({ request }: { request: Request }) => {
    writes.push(`${request.method} ${new URL(request.url).pathname}`);
    return new HttpResponse(null, { status: 204 });
  };

  server.use(
    http.get(apiUrl("/notifications/history"), ({ request }) => {
      const unread = new URL(request.url).searchParams.get("unread") === "true";
      return HttpResponse.json({
        items: entries.filter((e) => !unread || !e.readAt),
        hasMore: false,
      });
    }),
    http.get(apiUrl("/notifications/counts"), () =>
      HttpResponse.json({
        unread: entries.filter((e) => !e.readAt).length,
        unseen: 0,
      }),
    ),
    http.get(apiUrl("/social/requests"), () => HttpResponse.json([])),
    http.post(apiUrl("/notifications/seen"), write),
    http.patch(apiUrl("/notifications/:id/read"), write),
    http.patch(apiUrl("/notifications/:id/unread"), write),
    http.delete(apiUrl("/notifications/:id"), write),
  );
  return writes;
}

beforeEach(() => {
  layout.compact = false;
  visit("/app/notifications");
});
afterEach(() => {
  for (const item of toast.items) toast.dismiss(item.id);
});

it("lays the history out by day, read entries included, and counts as seen", async () => {
  const writes = serve([fresh, old]);
  renderWithQuery(NotificationsPage, {});

  expect(await screen.findByText("Alice")).toBeTruthy();
  expect(screen.getByText("Bob")).toBeTruthy();
  expect(screen.getByRole("heading", { name: m.common_today() })).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: m.notif_day_older() }),
  ).toBeTruthy();
  expect(writes).toContain("POST /api/notifications/seen");
});

it("keeps the filter in the address", async () => {
  serve([fresh, old]);
  renderWithQuery(NotificationsPage, {});
  const user = userEvent.setup();

  const unreadOnly = await screen.findByRole("button", {
    name: new RegExp(m.notif_filter_unread()),
  });
  await waitFor(() => expect(unreadOnly.textContent).toContain("1"));
  await user.click(unreadOnly);

  await waitFor(() => expect(page.url.search).toBe("?filter=unread"));
  expect(unreadOnly.getAttribute("aria-pressed")).toBe("true");
});

it("lets go of an entry read from the unread list", async () => {
  visit("/app/notifications?filter=unread");
  const writes = serve([fresh]);
  renderWithQuery(NotificationsPage, {});
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole("button", { name: m.common_more_actions() }),
  );
  await user.click(screen.getByRole("menuitem", { name: m.notif_mark_read() }));

  await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
  expect(writes).toContain("PATCH /api/notifications/alice/read");
});

it("reads with a swipe right and deletes with a swipe left on a phone", async () => {
  layout.compact = true;
  const writes = serve([fresh]);
  renderWithQuery(NotificationsPage, {});
  const row = (await screen.findByText("Alice")).closest("a")!;

  const swipe = async (to: number) => {
    await fireEvent.pointerDown(row, {
      pointerId: 1,
      button: 0,
      clientX: 150,
      clientY: 10,
    });
    await fireEvent.pointerMove(row, {
      pointerId: 1,
      clientX: 150 + to / 2,
      clientY: 10,
    });
    await fireEvent.pointerMove(row, {
      pointerId: 1,
      clientX: 150 + to,
      clientY: 10,
    });
    await fireEvent.pointerUp(row, {
      pointerId: 1,
      clientX: 150 + to,
      clientY: 10,
    });
  };

  await swipe(120);
  await waitFor(() =>
    expect(writes).toContain("PATCH /api/notifications/alice/read"),
  );

  await swipe(-120);
  await waitFor(() =>
    expect(toast.items.map((t) => t.message)).toContain(m.notif_deleted()),
  );
  await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
});

it("offers to mark everything read only while something is unread", async () => {
  serve([old]);
  renderWithQuery(NotificationsPage, {});

  await screen.findByText("Bob");

  expect(
    screen.queryByRole("button", { name: m.notif_mark_all_read() }),
  ).toBeNull();
});

it("says the history didn't load rather than that there's nothing left", async () => {
  serve([fresh]);
  server.use(
    http.get(apiUrl("/notifications/history"), () =>
      HttpResponse.json({ code: ErrorCode.InternalError }, { status: 500 }),
    ),
  );
  renderWithQuery(NotificationsPage, {});

  await waitFor(() =>
    expect(document.querySelector(".text-danger")).not.toBeNull(),
  );
  expect(screen.queryByText(m.notif_empty_title())).toBeNull();
});
