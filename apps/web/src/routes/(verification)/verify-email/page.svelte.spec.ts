import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { ErrorCode } from "@loomkeep/shared";
import { fireEvent, screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import VerifyEmailPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

let calls: number;

beforeEach(() => {
  calls = 0;
  visit("/verify-email?token=one-time");
  // The token is single-use: the API deletes it on the first call.
  server.use(
    http.post(apiUrl("/auth/verify-email"), () => {
      calls++;
      return calls === 1
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(
            { code: ErrorCode.AuthInvalidVerificationToken },
            { status: 401 },
          );
    }),
  );
});

it("keeps the success once the single-use link has been spent", async () => {
  renderWithQuery(VerifyEmailPage, {});
  expect(await screen.findByText(m.auth_verify_email_done())).toBeTruthy();

  // Coming back to the tab used to send the spent token again.
  await fireEvent(window, new Event("visibilitychange"));
  await fireEvent(window, new Event("focus"));
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(calls).toBe(1);
  expect(screen.getByText(m.auth_verify_email_done())).toBeTruthy();
});
