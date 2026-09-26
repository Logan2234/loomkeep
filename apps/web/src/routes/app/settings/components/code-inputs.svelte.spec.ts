import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { MfaStatusDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MfaSection from "./MfaSection.svelte";
import SecuritySection from "./SecuritySection.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

// Codes are pasted from an authenticator or an email, often with spaces
// around or inside them; a `maxlength` counting those spaces used to cut
// digits off before they could be trimmed.
const PASTED_CODES = [" 123456", "123 456", "123456\n"];

const MFA_STATUS: MfaStatusDto = {
  totpEnabled: false,
  emailEnabled: false,
  recoveryCodesRemaining: 0,
  webauthnCredentials: [],
  passwordlessEnabled: false,
};

let sentCode: unknown;

beforeEach(() => {
  sentCode = undefined;
  auth.user = {
    id: "u1",
    username: "logan",
    email: "logan@example.com",
    emailVerified: true,
  } as UserDto;
  server.use(
    http.get(apiUrl("/users/me/mfa"), () => HttpResponse.json(MFA_STATUS)),
    http.get(apiUrl("/auth/sessions"), () => HttpResponse.json([])),
  );
});

async function pasteCode(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
) {
  const dialog = screen.getByRole("dialog");
  await user.click(
    within(dialog).getByRole("textbox", { name: m.common_code() }),
  );
  await user.paste(code);
  return dialog;
}

describe("TOTP setup confirmation code", () => {
  beforeEach(() => {
    server.use(
      http.post(apiUrl("/users/me/mfa/totp/setup"), () =>
        HttpResponse.json({
          secret: "JBSWY3DPEHPK3PXP",
          otpauthUri: "otpauth://totp/Loomkeep:logan?secret=JBSWY3DPEHPK3PXP",
        }),
      ),
      http.post(apiUrl("/users/me/mfa/totp/confirm"), async ({ request }) => {
        sentCode = ((await request.json()) as { code: string }).code;
        return HttpResponse.json({ recoveryCodes: null });
      }),
    );
  });

  it.each(PASTED_CODES)("keeps every digit of %j", async (pasted) => {
    const user = userEvent.setup();
    renderWithQuery(MfaSection, {});

    await user.click(
      await screen.findByRole("switch", { name: m.auth_mfa_totp_label() }),
    );
    const next = await screen.findByRole("button", { name: m.common_next() });
    await waitFor(() =>
      expect((next as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(next);
    const dialog = await pasteCode(user, pasted);
    await user.click(
      within(dialog).getByRole("button", { name: m.common_enable() }),
    );

    await waitFor(() => expect(sentCode).toBe("123456"));
  });
});

describe("email change confirmation code", () => {
  beforeEach(() => {
    server.use(
      http.patch(apiUrl("/users/me/email"), () =>
        HttpResponse.json(null, { status: 200 }),
      ),
      http.patch(apiUrl("/users/me/email/confirm"), async ({ request }) => {
        sentCode = ((await request.json()) as { code: string }).code;
        return HttpResponse.json(auth.user);
      }),
    );
  });

  it.each(PASTED_CODES)("keeps every digit of %j", async (pasted) => {
    const user = userEvent.setup();
    renderWithQuery(SecuritySection, {});

    const emailRow = document.getElementById("email")!;
    await user.click(
      within(emailRow).getByRole("button", { name: m.common_edit() }),
    );
    const form = screen.getByRole("dialog");
    await user.type(
      within(form).getByRole("textbox", {
        name: new RegExp(`^${m.settings_new_email_label()}`),
      }),
      "new@example.com",
    );
    await user.type(
      form.querySelector<HTMLInputElement>('input[name="currentPassword"]')!,
      "hunter2",
    );
    await user.click(
      within(form).getByRole("button", { name: m.common_save() }),
    );

    await screen.findByText(m.settings_confirmation_sent(), { exact: false });
    const dialog = await pasteCode(user, pasted);
    await user.click(
      within(dialog).getByRole("button", { name: m.common_confirm() }),
    );

    await waitFor(() => expect(sentCode).toBe("123456"));
  });
});
