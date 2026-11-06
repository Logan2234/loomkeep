import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { ErrorCode } from "@loomkeep/shared";
import { fireEvent, screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import CancelDeletionPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

let calls: number;

beforeEach(() => {
  calls = 0;
  visit("/account/cancel-deletion?token=one-time");
  // The link works once: the API clears the token with the deletion.
  server.use(
    http.post(apiUrl("/users/deletion/cancel"), () => {
      calls++;
      return calls === 1
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(
            { code: ErrorCode.UserDeletionCancelLinkInvalid },
            { status: 400 },
          );
    }),
  );
});

it("keeps the cancellation once the single-use link has been spent", async () => {
  renderWithQuery(CancelDeletionPage, {});
  expect(await screen.findByText(m.cancel_deletion_done_title())).toBeTruthy();

  // Coming back to the tab used to send the spent token again.
  await fireEvent(window, new Event("visibilitychange"));
  await fireEvent(window, new Event("focus"));
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(calls).toBe(1);
  expect(screen.getByText(m.cancel_deletion_done_title())).toBeTruthy();
});
