import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import MfaSection from "./MfaSection.svelte";
describe("MFA confirmation orchestration", () => {
  it("passes the confirmed password through the extracted modal before disabling TOTP", async () => {
    let payload: unknown;
    server.use(
      http.get(apiUrl("/users/me/mfa"), () =>
        HttpResponse.json({
          totpEnabled: true,
          emailEnabled: false,
          passwordlessEnabled: false,
          webauthnCredentials: [],
          recoveryCodesRemaining: 4,
        }),
      ),
      http.post(apiUrl("/users/me/mfa/totp/disable"), async ({ request }) => {
        payload = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithQuery(MfaSection, {});
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("switch", { name: m.auth_mfa_totp_label() }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: m.settings_mfa_totp_disable_title(),
    });
    await user.type(
      within(dialog).getByLabelText(m.common_current_password(), {
        selector: "input",
      }),
      "test-password",
    );
    await user.click(
      within(dialog).getByRole("button", { name: m.common_disable() }),
    );
    await waitFor(() =>
      expect(payload).toEqual({ currentPassword: "test-password" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
