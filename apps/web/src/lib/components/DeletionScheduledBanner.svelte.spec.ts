import { auth } from "#lib/auth.svelte.js";
import { formatDate } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeletionScheduledBanner from "./DeletionScheduledBanner.svelte";

vi.mock("$app/state", async () => import("#lib/test/navigation.svelte.js"));
vi.mock(
  "$app/navigation",
  async () => import("#lib/test/navigation.svelte.js"),
);

const SCHEDULED_FOR = "2026-11-04T05:15:00.000Z";
const bannerText = () =>
  screen.queryByText(
    m.settings_deletion_banner({ date: formatDate(SCHEDULED_FOR) }),
  );

beforeEach(async () => {
  await goto("/app");
  auth.user = {
    id: "user-1",
    deletionScheduledFor: SCHEDULED_FOR,
  } as UserDto;
});

describe("DeletionScheduledBanner", () => {
  it("says when the account goes, everywhere in the app", () => {
    renderWithQuery(DeletionScheduledBanner, {});

    expect(bannerText()).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: m.settings_delete_account_export_link() })
        .getAttribute("href"),
    ).toBe("/app/settings/export");
  });

  it("stays out of the deletion page, which says it already", async () => {
    await goto("/app/settings/delete-account");
    renderWithQuery(DeletionScheduledBanner, {});

    expect(bannerText()).toBeNull();
  });

  it("goes away once the deletion is cancelled", async () => {
    server.use(
      http.delete(
        apiUrl("/users/me/deletion"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderWithQuery(DeletionScheduledBanner, {});

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: m.settings_delete_account_cancel(),
      }),
    );

    await waitFor(() => expect(bannerText()).toBeNull());
    expect(auth.user?.deletionScheduledFor).toBeNull();
  });
});
