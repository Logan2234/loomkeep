import { chat } from "#lib/chat/chat.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { mobileNav } from "#lib/mobile-nav.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EdgeTab from "./EdgeTab.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

function serve({ unseen = 0, requests = 0, messages = 0 } = {}) {
  server.use(
    http.get(apiUrl("/notifications/counts"), () =>
      HttpResponse.json({ unread: unseen, unseen }),
    ),
    http.get(apiUrl("/social/requests"), () =>
      HttpResponse.json(
        Array.from({ length: requests }, (_, i) => ({
          id: `r${i}`,
          user: {
            id: `u${i}`,
            username: `u${i}`,
            displayName: "U",
            avatarUrl: null,
          },
          createdAt: "2026-10-14T00:00:00Z",
        })),
      ),
    ),
    http.get(apiUrl("/chat/unread"), () =>
      HttpResponse.json({ count: messages, works: 0 }),
    ),
  );
}

beforeEach(() => {
  visit("/app");
  Object.assign(appConfig, { chatEnabled: true });
  mobileNav.edgeTab = { side: "right", y: 2 / 3 };
});

afterEach(() => {
  chat.open = false;
});

// The phone's alerts badge used to leave the follow requests out, which the
// desktop bell counted: a lone request lit nothing on a phone.
it("counts alerts, follow requests and messages on the tab", async () => {
  serve({ unseen: 2, requests: 1, messages: 3 });
  renderWithQuery(EdgeTab, {});

  expect(
    await screen.findByRole("button", {
      name: m.nav_edge_tab_unread({ count: 6 }),
    }),
  ).toBeTruthy();
});

it("fans Alerts and Messages out on a tap, each with its own count", async () => {
  serve({ unseen: 2, messages: 3 });
  renderWithQuery(EdgeTab, {});
  const user = userEvent.setup();

  await user.click(
    await screen.findByRole("button", {
      name: m.nav_edge_tab_unread({ count: 5 }),
    }),
  );

  const alerts = await screen.findByRole("link", {
    name: new RegExp(m.nav_notifications_short()),
  });
  expect(alerts.getAttribute("href")).toBe("/app/notifications");
  expect(alerts.textContent).toContain("2");
  await user.click(
    screen.getByRole("button", { name: new RegExp(m.chat_title()) }),
  );
  expect(chat.open).toBe(true);
});

it("leads straight to the alerts where Messages is off", async () => {
  Object.assign(appConfig, { chatEnabled: false });
  serve();
  renderWithQuery(EdgeTab, {});

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: m.nav_edge_tab() }));

  expect(goto).toHaveBeenCalledWith("/app/notifications");
});

it("moves to where a long press drops it, and remembers it", async () => {
  serve();
  renderWithQuery(EdgeTab, {});
  const tab = screen.getByRole("button", { name: m.nav_edge_tab() });
  vi.useFakeTimers();

  try {
    await fireEvent.pointerDown(tab, {
      pointerId: 1,
      clientX: 790,
      clientY: 500,
    });
    vi.advanceTimersByTime(500);
    await fireEvent.pointerMove(tab, {
      pointerId: 1,
      clientX: 10,
      clientY: innerHeight * 0.4,
    });
    await fireEvent.pointerUp(tab, {
      pointerId: 1,
      clientX: 10,
      clientY: innerHeight * 0.4,
    });
  } finally {
    vi.useRealTimers();
  }

  await waitFor(() => expect(mobileNav.edgeTab.side).toBe("left"));
  expect(mobileNav.edgeTab.y).toBeCloseTo(0.4);
});
