import { languageName } from "$lib/locales";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { ErrorCode } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmailTab from "./EmailTab.svelte";

let requests: URL[];
vi.mock("$app/state", async () => await import("$lib/test/navigation.svelte"));
vi.mock(
  "$app/navigation",
  async () => await import("$lib/test/navigation.svelte"),
);
let sent: unknown;
beforeEach(() => {
  visit("/app/admin/communications?tab=email");
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
  it("opens the requested template and locale and exposes the subject before the HTML preview", async () => {
    visit("/app/admin/communications?tab=email&template=newsletter&locale=it");
    renderWithQuery(EmailTab, {});
    await waitFor(() =>
      expect(requests.at(-1)?.pathname).toContain("newsletter/preview"),
    );
    expect(requests.at(-1)?.searchParams.get("locale")).toBe("it");
    const subject = await screen.findByText(
      m.admin_communications_subject({ subject: "Preview" }).trim(),
    );
    const iframe = screen.getByTitle(m.admin_communications_email_preview());
    expect(
      subject.compareDocumentPosition(iframe) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: m.admin_preview_phone() }));
    await waitFor(() =>
      expect((iframe as HTMLElement).style.width).toBe("375px"),
    );
    expect((iframe as HTMLElement).style.maxWidth).toBe("100%");
    expect(
      screen
        .getByRole("button", { name: m.admin_preview_phone() })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("searches desktop templates and copies the active plain-text preview", async () => {
    renderWithQuery(EmailTab, {});
    const user = userEvent.setup();
    const search = await screen.findByRole("searchbox", {
      name: m.admin_communications_template(),
    });
    await user.type(search, "newsletter");
    const nav = screen.getByRole("navigation", {
      name: m.admin_communications_template(),
    });
    expect(
      within(nav).queryByRole("button", {
        name: m.admin_template_security_alert(),
      }),
    ).toBeNull();
    await user.click(
      within(nav).getByRole("button", { name: m.common_newsletter() }),
    );
    await waitFor(() =>
      expect(requests.at(-1)?.pathname).toContain("newsletter/preview"),
    );
    await user.click(
      screen.getByRole("button", { name: m.admin_communications_plain_text() }),
    );
    const copy = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByRole("button", { name: m.admin_copy_text() }));
    expect(copy).toHaveBeenCalledWith("newsletter en ");
  });
  it("shows recipient validation errors next to the recipient field", async () => {
    server.use(
      http.post(apiUrl("/admin/emails/:key/test"), () =>
        HttpResponse.json(
          {
            code: ErrorCode.ValidationFailed,
            details: [{ field: "to", constraint: "isEmail", params: [] }],
          },
          { status: 400 },
        ),
      ),
    );
    renderWithQuery(EmailTab, {});
    const user = userEvent.setup();
    const recipient = await screen.findByRole("textbox", {
      name: m.admin_communications_recipient_placeholder(),
    });
    await user.type(recipient, "invalid");
    await user.click(
      screen.getByRole("button", { name: m.admin_communications_send_test() }),
    );
    await screen.findByText(m.valerr_is_email());
    expect(recipient.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(recipient.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain(m.valerr_is_email());
  });
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
