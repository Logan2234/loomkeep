import { auth } from "#lib/auth.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import { ErrorCode, type UserDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "./NotificationBell.svelte";

vi.mock("#lib/realtime/socket.js", () => ({ onRealtimeEvent: () => () => {} }));
vi.mock("svelte/transition", () => ({
  slide: () => ({ duration: 0 }),
  fade: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));
afterEach(() => {
  for (const item of toast.items) toast.dismiss(item.id);
  auth.user = null;
});

describe("follow request failures", () => {
  it.each([
    ["accept", false],
    ["reject", false],
    ["accept", true],
    ["reject", true],
  ] as const)(
    "shows an error and allows retry after %s fails (compact: %s)",
    async (action, compact) => {
      layout.compact = compact;
      let fail = true;
      server.use(
        http.get(apiUrl("/notifications"), () =>
          HttpResponse.json({ notifications: [], unread: 0 }),
        ),
        http.get(apiUrl("/social/requests"), () =>
          HttpResponse.json([
            {
              id: "request",
              user: {
                id: "alice",
                username: "alice",
                displayName: "Alice",
                avatarUrl: null,
              },
              createdAt: "2026-10-04T00:00:00Z",
            },
          ]),
        ),
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
      const user = userEvent.setup();
      if (compact)
        await fireEvent(window, new CustomEvent("mobile-notifications-toggle"));
      else
        await user.click(
          screen.getByRole("button", { name: m.common_notifications() }),
        );
      const button = await screen.findByRole("button", {
        name: action === "accept" ? m.common_accept() : m.common_reject(),
      });
      await user.click(button);
      await waitFor(() =>
        expect(toast.items.some((item) => item.variant === "error")).toBe(true),
      );
      expect(screen.getByText("Alice")).toBeTruthy();
      await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
      fail = false;
      await user.click(button);
      await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
    },
  );
});

describe("a notification leading to a domain the viewer turned off", () => {
  it("isn't a link, and says why", async () => {
    layout.compact = false;
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    const notification = (id: string, title: string, url: string) => ({
      id,
      type: "COMMENT_REPLY",
      title,
      body: null,
      url,
      data: {},
      timestamp: "2026-10-04T00:00:00Z",
      createdAt: "2026-10-04T00:00:00Z",
    });
    server.use(
      http.get(apiUrl("/notifications"), () =>
        HttpResponse.json({
          notifications: [
            notification("dune", "Dune", "/app/media/movie/1"),
            notification("bg3", "Baldur's Gate 3", "/app/games/2"),
          ],
          unread: 2,
        }),
      ),
      http.get(apiUrl("/social/requests"), () => HttpResponse.json([])),
    );
    renderWithQuery(NotificationBell, {});
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: m.common_notifications() }),
    );
    await screen.findByText("Baldur's Gate 3");

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
