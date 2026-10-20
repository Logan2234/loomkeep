import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import MfaSection from "./MfaSection.svelte";

describe("MFA settings", () => {
  // The password is no longer typed here: the server asks for a confirmation
  // of identity when this session needs one (see ReauthModal).
  it("asks before disabling the authenticator app, then disables it", async () => {
    let disabled = false;
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
      http.post(apiUrl("/users/me/mfa/totp/disable"), () => {
        disabled = true;
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
    expect(disabled).toBe(false);

    await user.click(
      within(dialog).getByRole("button", { name: m.common_disable() }),
    );

    await waitFor(() => expect(disabled).toBe(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
