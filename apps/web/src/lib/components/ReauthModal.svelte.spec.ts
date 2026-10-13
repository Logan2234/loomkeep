import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { m } from "#lib/paraglide/messages.js";
import { reauth } from "#lib/reauth.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { ErrorCode, type ReauthMethod } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReauthModal from "./ReauthModal.svelte";

const { startAuthentication } = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
}));
vi.mock("@simplewebauthn/browser", () => ({ startAuthentication }));

const UNTIL = "2026-10-13T12:10:00.000Z";

let proofs: unknown[];

function serve(methods: ReauthMethod[], answer?: () => Response) {
  server.use(
    http.get(apiUrl("/auth/reauth"), () =>
      HttpResponse.json({ methods, confirmedUntil: null }),
    ),
    http.post(apiUrl("/auth/reauth/webauthn-options"), () =>
      HttpResponse.json({ webauthnChallengeId: "ch-1", options: {} }),
    ),
    http.post(apiUrl("/auth/reauth"), async ({ request }) => {
      proofs.push(await request.json());
      return answer?.() ?? HttpResponse.json({ confirmedUntil: UNTIL });
    }),
  );
}

function open() {
  const confirmed = reauth.confirm(m.reauth_reason_api_key());
  renderWithQuery(ReauthModal, { reason: m.reauth_reason_api_key() });
  return confirmed;
}

describe("ReauthModal", () => {
  beforeEach(() => {
    proofs = [];
    localStorage.clear();
    startAuthentication.mockReset();
  });
  afterEach(() => reauth.cancelled());

  it("opens on the security key and confirms with it", async () => {
    serve(["webauthn", "totp", "password"]);
    startAuthentication.mockResolvedValue({ id: "cred-1" });
    const user = userEvent.setup();
    const confirmed = open();

    await user.click(
      await screen.findByRole("button", { name: m.reauth_webauthn_use() }),
    );

    await expect(confirmed).resolves.toBe(true);
    expect(proofs).toEqual([
      {
        method: "webauthn",
        webauthnChallengeId: "ch-1",
        response: { id: "cred-1" },
      },
    ]);
    expect(reauth.confirmedUntil).toBe(Date.parse(UNTIL));
  });

  it("turns to the password once the key's prompt is closed, and remembers it", async () => {
    serve(["webauthn", "password"]);
    startAuthentication.mockRejectedValue(
      new DOMException("closed", "NotAllowedError"),
    );
    const user = userEvent.setup();
    const confirmed = open();

    await user.click(
      await screen.findByRole("button", { name: m.reauth_webauthn_use() }),
    );
    expect(await screen.findByText(m.reauth_webauthn_cancelled())).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: m.reauth_other_method() }),
    );
    await user.click(
      screen.getByRole("button", { name: new RegExp(m.common_password()) }),
    );
    await user.type(
      screen.getByLabelText(m.common_current_password(), { selector: "input" }),
      "popcorn",
    );
    await user.click(screen.getByRole("button", { name: m.common_confirm() }));

    await expect(confirmed).resolves.toBe(true);
    expect(proofs).toEqual([{ method: "password", password: "popcorn" }]);
    expect(localStorage.getItem(STORAGE_KEYS.reauthMethod)).toBe("password");
  });

  it("comes back on the method last used, and says when its code already served", async () => {
    localStorage.setItem(STORAGE_KEYS.reauthMethod, "totp");
    serve(["webauthn", "totp", "password"], () =>
      HttpResponse.json(
        { code: ErrorCode.AuthTotpCodeReused, message: "x" },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    open();

    // Six digits send themselves.
    await user.type(
      await screen.findByRole("textbox", { name: m.common_code() }),
      "135790",
    );

    expect(
      await screen.findByText(m.apierr_auth_totp_code_reused()),
    ).toBeTruthy();
    expect(proofs).toEqual([{ method: "totp", code: "135790" }]);
  });

  it("drops the action when it's closed", async () => {
    serve(["password"]);
    const user = userEvent.setup();
    const confirmed = open();

    await screen.findByLabelText(m.common_current_password(), {
      selector: "input",
    });
    expect(
      screen.queryByRole("button", { name: m.reauth_other_method() }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: m.common_cancel() }));

    await expect(confirmed).resolves.toBe(false);
    await waitFor(() => expect(proofs).toEqual([]));
  });
});
