import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { goto, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { ErrorCode, type MfaMethod, type UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

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

async function signIn() {
  const user = userEvent.setup();
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

async function enterCode(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
) {
  await user.type(await screen.findByRole("textbox"), code);
  await user.click(screen.getByRole("button", { name: m.common_verify() }));
}

describe("login page", () => {
  it("signs in and opens the app", async () => {
    serveLogin();
    await signIn();

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/app"));
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

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/app/books?fav=1"));
  });

  it.each(["https://evil.example", "//evil.example"])(
    "never follows an external redirect target (%s)",
    async (target) => {
      visit(`/login?redirectTo=${encodeURIComponent(target)}`);
      serveLogin();
      await signIn();

      await waitFor(() => expect(goto).toHaveBeenCalledWith("/app"));
    },
  );

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
    await enterCode(user, "123456");

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/app"));
    expect(posted["/auth/mfa/verify"]).toEqual({
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  // The field's length cap used to count the spaces of a pasted code, cutting
  // " 123456" down to " 12345" before they could be trimmed.
  it.each([" 123456", "123 456", "123456\n"])(
    "keeps every digit of a code pasted with spaces (%j)",
    async (pasted) => {
      serveLogin(mfaChallenge(["totp", "recovery"]));
      const user = await signIn();

      await user.click(await screen.findByRole("textbox"));
      await user.paste(pasted);
      await user.click(screen.getByRole("button", { name: m.common_verify() }));

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
    expect(screen.getByText(m.auth_mfa_recovery_code_label())).toBeTruthy();
    await enterCode(user, "ABCDE-12345");

    await waitFor(() =>
      expect(posted["/auth/mfa/verify"]).toEqual({
        challengeId: "challenge-1",
        code: "ABCDE-12345",
      }),
    );
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
