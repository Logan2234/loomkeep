import { ApiError } from "#lib/api/core.js";
import { resolveApiError } from "#lib/api/errors.js";
import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { ErrorCode, type MfaMethod, type UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const { instancePicker } = vi.hoisted(() => ({
  instancePicker: { available: false, open: vi.fn(() => Promise.resolve()) },
}));
vi.mock("#lib/native/instance.js", () => ({
  isInstancePickerAvailable: () => instancePicker.available,
  openInstancePicker: instancePicker.open,
}));

const USER = { id: "u1", displayName: "Logan" } as UserDto;

let posted: Record<string, unknown>;

function serveLogin(
  response: object | ((body: unknown) => Response) = {
    mfaRequired: false,
    user: USER,
  },
) {
  server.use(
    http.post(apiUrl("/auth/login"), async ({ request }) => {
      const body = await request.json();
      posted["/auth/login"] = body;
      return typeof response === "function"
        ? response(body)
        : HttpResponse.json(response);
    }),
  );
}

const mfaChallenge = (availableMethods: MfaMethod[]) => ({
  mfaRequired: true,
  challengeId: "challenge-1",
  availableMethods,
});

beforeEach(() => {
  posted = {};
  auth.clear();
  visit("/login");
  server.use(
    http.get(apiUrl("/users/me/entitlement"), () =>
      HttpResponse.json({ isPremium: false }),
    ),
    http.post(apiUrl("/auth/mfa/verify"), async ({ request }) => {
      posted["/auth/mfa/verify"] = await request.json();
      return HttpResponse.json({ user: USER });
    }),
    http.post(apiUrl("/auth/mfa/resend-email-code"), async ({ request }) => {
      posted["/auth/mfa/resend-email-code"] = await request.json();
      return new HttpResponse(null, { status: 201 });
    }),
  );
});

async function signIn(user = userEvent.setup()) {
  renderWithQuery(LoginPage, {});
  await user.type(
    screen.getByRole("textbox", {
      name: m.auth_login_identifier_placeholder(),
    }),
    "logan",
  );
  await user.type(screen.getByLabelText(m.common_password()), "hunter2");
  await user.click(screen.getByRole("button", { name: m.common_login() }));
  return user;
}

const firstDigit = () =>
  screen.findByRole("textbox", {
    name: m.auth_mfa_code_digit({ position: 1, total: 6 }),
  });

const rejectCodes = () => {
  let verifications = 0;
  server.use(
    http.post(apiUrl("/auth/mfa/verify"), () => {
      verifications++;
      return HttpResponse.json(
        { code: ErrorCode.AuthMfaInvalidCode, message: "nope" },
        { status: 400 },
      );
    }),
  );
  return () => verifications;
};

const invalidCode = () =>
  resolveApiError(new ApiError(400, "", ErrorCode.AuthMfaInvalidCode));

describe("login page", () => {
  it("signs in and opens the app", async () => {
    serveLogin();
    await signIn();

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app", { replace: true }),
    );
    expect(posted["/auth/login"]).toEqual({
      identifier: "logan",
      password: "hunter2",
    });
    expect(auth.user).toEqual(USER);
  });

  it("returns to the page that asked for a sign-in", async () => {
    visit("/login?redirectTo=/app/books?fav=1");
    serveLogin();
    await signIn();

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app/books?fav=1", { replace: true }),
    );
  });

  // Browsers read "\" as "/" and drop tabs/newlines in a URL, so the last
  // three all resolve to https://evil.example.
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
  ])("never follows an external redirect target (%s)", async (target) => {
    visit(`/login?redirectTo=${encodeURIComponent(target)}`);
    serveLogin();
    await signIn();

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app", { replace: true }),
    );
  });

  it("falls back to the app on a redirect target that isn't a URL", async () => {
    visit(`/login?redirectTo=${encodeURIComponent("http://[")}`);
    serveLogin();
    await signIn();

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app", { replace: true }),
    );
  });

  it("explains a rejected sign-in and stays on the form", async () => {
    serveLogin(() =>
      HttpResponse.json(
        { code: ErrorCode.AuthInvalidCredentials, message: "nope" },
        { status: 401 },
      ),
    );
    await signIn();

    expect(
      await screen.findByText(
        resolveApiError(
          new ApiError(401, "", ErrorCode.AuthInvalidCredentials),
        ),
      ),
    ).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
    expect(auth.user).toBeNull();
  });

  it("asks straight for the code when the account has one method", async () => {
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();

    expect(await screen.findByText(m.auth_mfa_code_totp_hint())).toBeTruthy();
    await user.type(await firstDigit(), "123456");

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app", { replace: true }),
    );
    expect(posted["/auth/mfa/verify"]).toEqual({
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("verifies a six-digit code as soon as it's complete", async () => {
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();

    await user.type(await firstDigit(), "12345");
    expect(posted["/auth/mfa/verify"]).toBeUndefined();
    await user.keyboard("6");

    await waitFor(() =>
      expect(posted["/auth/mfa/verify"]).toEqual({
        challengeId: "challenge-1",
        code: "123456",
      }),
    );
  });

  it("doesn't verify the same code again when a digit is retyped", async () => {
    const verifications = rejectCodes();
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();

    await user.type(await firstDigit(), "123456");
    await waitFor(() => expect(verifications()).toBe(1));
    await user.keyboard("6");

    await new Promise((r) => setTimeout(r, 50));
    expect(verifications()).toBe(1);
  });

  it("shows a rejected code's error for a few seconds only", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      rejectCodes();
      serveLogin(mfaChallenge(["totp", "recovery"]));
      const user = await signIn(
        userEvent.setup({ advanceTimers: vi.advanceTimersByTime }),
      );

      await user.type(await firstDigit(), "123456");
      expect(await screen.findByText(invalidCode())).toBeTruthy();

      vi.advanceTimersByTime(5000);
      await waitFor(() => expect(screen.queryByText(invalidCode())).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for the button on a recovery code", async () => {
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();
    await user.click(
      await screen.findByRole("button", {
        name: m.auth_mfa_use_recovery_code(),
      }),
    );

    await user.type(screen.getByRole("textbox"), "ABCDE-12345");

    expect(posted["/auth/mfa/verify"]).toBeUndefined();
  });

  // The field's length cap used to count the spaces of a pasted code, cutting
  // " 123456" down to " 12345" before they could be trimmed.
  it.each([" 123456", "123 456", "123456\n"])(
    "keeps every digit of a code pasted with spaces (%j)",
    async (pasted) => {
      serveLogin(mfaChallenge(["totp", "recovery"]));
      const user = await signIn();

      await user.click(await firstDigit());
      await user.paste(pasted);

      await waitFor(() =>
        expect(posted["/auth/mfa/verify"]).toEqual({
          challengeId: "challenge-1",
          code: "123456",
        }),
      );
    },
  );

  it("only sends an email code once the user picks that method", async () => {
    serveLogin(mfaChallenge(["totp", "email", "recovery"]));
    const user = await signIn();

    const emailChoice = await screen.findByRole("button", {
      name: new RegExp(m.auth_mfa_email_label()),
    });
    expect(posted["/auth/mfa/resend-email-code"]).toBeUndefined();

    await user.click(emailChoice);

    expect(await screen.findByText(m.auth_mfa_code_email_hint())).toBeTruthy();
    expect(posted["/auth/mfa/resend-email-code"]).toEqual({
      challengeId: "challenge-1",
    });
  });

  it("accepts a recovery code instead of the usual one", async () => {
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();
    await screen.findByText(m.auth_mfa_code_totp_hint());

    await user.click(
      screen.getByRole("button", { name: m.auth_mfa_use_recovery_code() }),
    );
    expect(
      await screen.findByText(m.auth_mfa_code_recovery_hint()),
    ).toBeTruthy();
    await user.type(
      screen.getByRole("textbox", { name: m.auth_mfa_recovery_code_label() }),
      "abcde12345",
    );
    await user.click(screen.getByRole("button", { name: m.common_verify() }));

    await waitFor(() =>
      expect(posted["/auth/mfa/verify"]).toEqual({
        challengeId: "challenge-1",
        code: "ABCDE-12345",
      }),
    );
  });

  it("forgets a method's error once another one is picked", async () => {
    server.use(
      http.post(apiUrl("/auth/mfa/resend-email-code"), () =>
        HttpResponse.json(
          { code: ErrorCode.AuthMfaTooManyAttempts, message: "nope" },
          { status: 429 },
        ),
      ),
    );
    serveLogin(mfaChallenge(["totp", "email", "recovery"]));
    const user = await signIn();
    const emailError = resolveApiError(
      new ApiError(429, "", ErrorCode.AuthMfaTooManyAttempts),
    );

    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(m.auth_mfa_email_label()),
      }),
    );
    expect(await screen.findByText(emailError)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: new RegExp(m.auth_mfa_totp_label()) }),
    );
    await user.click(
      await screen.findByRole("button", { name: m.common_back() }),
    );

    await screen.findByText(m.auth_mfa_choose_method_title());
    expect(screen.queryByText(emailError)).toBeNull();
  });

  it("goes back to the credentials with the password cleared", async () => {
    serveLogin(mfaChallenge(["totp", "recovery"]));
    const user = await signIn();
    await screen.findByText(m.auth_mfa_code_totp_hint());

    await user.click(screen.getByRole("button", { name: m.common_back() }));

    const password = screen.getByLabelText<HTMLInputElement>(
      m.common_password(),
    );
    expect(password.value).toBe("");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", {
        name: m.auth_login_identifier_placeholder(),
      }).value,
    ).toBe("logan");
  });
});

describe("login page in the Android app", () => {
  afterEach(() => {
    instancePicker.available = false;
    instancePicker.open.mockClear();
  });

  it("offers no other instance in a browser", () => {
    renderWithQuery(LoginPage, {});

    expect(
      screen.queryByRole("button", { name: m.auth_other_instance() }),
    ).toBeNull();
  });

  it("opens the app's instance picker", async () => {
    instancePicker.available = true;
    const user = userEvent.setup();
    renderWithQuery(LoginPage, {});

    await user.click(
      screen.getByRole("button", { name: m.auth_other_instance() }),
    );

    expect(instancePicker.open).toHaveBeenCalledOnce();
  });
});
