import { m } from "#lib/paraglide/messages.js";
import { appConfig } from "#lib/shell/config.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import AccessibilityPage from "./+page.svelte";

afterEach(() => {
  appConfig.contactFormEnabled = false;
});

describe("accessibility statement", () => {
  it("says what is checked, what isn't, and where to report a barrier", () => {
    renderWithQuery(AccessibilityPage, {});

    for (const heading of [
      m.accessibility_tested_heading(),
      m.accessibility_untested_heading(),
      m.accessibility_report_heading(),
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    expect(
      screen.getByRole("link", { name: "feedback.loomkeep.app" }),
    ).toBeTruthy();
    // An instance with no mailbox to write to only offers the ticket.
    expect(screen.queryByRole("button", { name: m.common_send() })).toBeNull();
  });

  it("sends a report through the form when the instance can receive one", async () => {
    appConfig.contactFormEnabled = true;
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(apiUrl("/contact/accessibility"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(AccessibilityPage, {});

    const send = screen.getByRole("button", { name: m.common_send() });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    await user.type(
      screen.getByLabelText(m.accessibility_form_message()),
      "The add button in search has no name for TalkBack.",
    );
    await user.type(
      screen.getByLabelText(m.accessibility_form_page()),
      "/app/search",
    );
    await user.click(send);

    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      expect.stringContaining(m.accessibility_form_sent()),
    );
    expect(body).toMatchObject({
      message: "The add button in search has no name for TalkBack.",
      page: "/app/search",
    });
    expect(body).not.toHaveProperty("website");
  });
});
