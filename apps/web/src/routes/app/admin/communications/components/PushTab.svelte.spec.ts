import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PushTab from "./PushTab.svelte";

vi.mock(
  "$app/state",
  async () => await import("#lib/test/navigation.svelte.js"),
);
vi.mock(
  "$app/navigation",
  async () => await import("#lib/test/navigation.svelte.js"),
);

let sent: unknown;

beforeEach(() => {
  visit("/app/admin/communications?tab=push&email=alice@example.com");
  sent = null;
  server.use(
    http.get(apiUrl("/admin/push/summary"), () =>
      HttpResponse.json({ subscriptions: 1, accounts: 1, byUserAgent: [] }),
    ),
    http.get(apiUrl("/admin/push/devices"), () =>
      HttpResponse.json([
        { id: "d1", userAgent: "LoomkeepApp/1.13.0", createdAt: "2026-10-01" },
      ]),
    ),
    http.get(apiUrl("/admin/users/options"), () =>
      HttpResponse.json({ items: [], hasMore: false }),
    ),
    http.post(apiUrl("/admin/push/test"), async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({
        subscriptionCount: 1,
        results: [{ userAgent: "LoomkeepApp/1.13.0", ok: true }],
      });
    }),
  );
});

describe("PushTab", () => {
  it("sends one of the app's notifications as a sample, without the custom fields", async () => {
    const user = userEvent.setup();
    renderWithQuery(PushTab, {});

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(m.admin_communications_push_type()),
      }),
    );
    await user.click(
      screen.getByRole("option", {
        name: new RegExp(m.settings_alert_follow_request()),
      }),
    );

    // The custom title and message go; the broadcast's stay below.
    expect(document.getElementById("admin-push-title")).toBeNull();
    expect(
      screen.getByText(m.admin_communications_push_sample_hint()),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: m.admin_communications_send_test() }),
    );

    await waitFor(() =>
      expect(sent).toEqual({
        email: "alice@example.com",
        type: "FOLLOW_REQUEST",
      }),
    );
  });

  it("still sends a custom push by default", async () => {
    const user = userEvent.setup();
    renderWithQuery(PushTab, {});

    await user.type(document.getElementById("admin-push-title")!, "Hello");
    await user.click(
      screen.getByRole("button", { name: m.admin_communications_send_test() }),
    );

    await waitFor(() =>
      expect(sent).toEqual({ email: "alice@example.com", title: "Hello" }),
    );
  });
});
