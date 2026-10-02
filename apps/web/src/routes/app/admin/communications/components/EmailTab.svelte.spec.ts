import { languageName } from "$lib/locales";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import EmailTab from "./EmailTab.svelte";

let requests: URL[];
let sent: unknown;
beforeEach(() => {
  requests = [];
  sent = null;
  server.use(
    http.get(apiUrl("/admin/emails"), () =>
      HttpResponse.json({
        smtpConfigured: true,
        templates: [
          {
            key: "welcome",
            label: "Welcome",
            fields: [{ key: "displayName", label: "Name", default: "Alice" }],
          },
          ...[
            "securityAlert",
            "newsletter",
            "moderationDecision",
            "adminNewUser",
          ].map((key) => ({ key, label: key, fields: [] })),
        ],
      }),
    ),
    http.get(apiUrl("/admin/emails/:key/preview"), ({ request, params }) => {
      const url = new URL(request.url);
      requests.push(url);
      const content = `${params.key} ${url.searchParams.get("locale")} ${url.searchParams.get("displayName") ?? ""}`;
      return HttpResponse.json({
        subject: "Preview",
        text: content,
        html: `<p>${content}</p>`,
      });
    }),
    http.post(apiUrl("/admin/emails/:key/test"), async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

describe("EmailTab", () => {
  it("groups the templates and places the test recipient before the preview controls", async () => {
    renderWithQuery(EmailTab, {});
    const nav = await screen.findByRole("navigation", {
      name: m.admin_communications_template(),
    });
    expect(
      within(nav)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual([
      m.common_account(),
      m.common_security(),
      m.admin_template_group_updates(),
      m.admin_template_group_moderation(),
      m.admin_template_group_admin(),
    ]);
    const recipient = screen.getByRole("textbox", {
      name: m.admin_communications_recipient_placeholder(),
    });
    const htmlControl = screen.getByRole("button", { name: "HTML" });
    expect(
      recipient.compareDocumentPosition(htmlControl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.setup().click(
      within(nav).getByRole("button", {
        name: m.admin_template_security_alert(),
      }),
    );
    await waitFor(() =>
      expect(requests.at(-1)?.pathname).toContain("securityAlert/preview"),
    );
  });

  it("retains edited variables when switching language and sends the same values as the preview", async () => {
    renderWithQuery(EmailTab, {});
    const user = userEvent.setup();
    const name = await screen.findByRole("textbox", { name: m.common_name() });
    await user.clear(name);
    await user.type(name, "Camille");
    const language = screen.getByRole("combobox", {
      name: new RegExp(m.common_language()),
    });
    await user.click(language);
    await user.click(screen.getByRole("option", { name: languageName("it") }));
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("locale")).toBe("it"),
    );
    expect(requests.at(-1)?.searchParams.get("displayName")).toBe("Camille");
    expect((name as HTMLInputElement).value).toBe("Camille");
    await user.click(
      screen.getByRole("button", { name: m.admin_communications_plain_text() }),
    );
    await screen.findByText(/welcome it Camille/);
    await user.type(
      screen.getByRole("textbox", {
        name: m.admin_communications_recipient_placeholder(),
      }),
      "recipient@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: m.admin_communications_send_test() }),
    );
    await waitFor(() =>
      expect(sent).toEqual({
        to: "recipient@example.com",
        locale: "it",
        values: { displayName: "Camille" },
      }),
    );
  });
});
