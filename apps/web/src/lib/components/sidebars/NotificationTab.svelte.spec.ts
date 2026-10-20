import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import NotificationTab from "./NotificationTab.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

function serve(unseen: number, requests: number) {
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
  );
}

// The phone's badge used to leave the follow requests out, which the
// desktop bell counted: a lone request lit nothing on a phone.
it("counts the pending follow requests too, as the desktop bell does", async () => {
  visit("/app");
  serve(2, 1);
  renderWithQuery(NotificationTab, {});

  const tab = screen.getByRole("link", { name: m.common_notifications() });
  await waitFor(() => expect(tab.textContent).toContain("3"));
});

it("leads to the notifications page, and says so while there", () => {
  visit("/app/notifications");
  serve(0, 0);
  renderWithQuery(NotificationTab, {});

  const tab = screen.getByRole("link", { name: m.common_notifications() });
  expect(tab.getAttribute("href")).toBe("/app/notifications");
  expect(tab.getAttribute("aria-current")).toBe("page");
});
