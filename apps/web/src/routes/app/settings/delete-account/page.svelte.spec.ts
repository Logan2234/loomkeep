import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { reauth } from "#lib/reauth.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type {
  AccountDeletionSummaryDto,
  ScheduleAccountDeletionRequestDto,
  UserDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteAccountPage from "./+page.svelte";

vi.mock("$app/state", async () => import("#lib/test/navigation.svelte.js"));
vi.mock(
  "$app/navigation",
  async () => import("#lib/test/navigation.svelte.js"),
);

function summary(
  overrides: Partial<AccountDeletionSummaryDto> = {},
): AccountDeletionSummaryDto {
  return {
    sessions: 3,
    deleted: [
      { category: "LIBRARY", count: 412 },
      { category: "PROGRESSION", count: 23 },
    ],
    anonymized: [{ category: "REVIEWS", count: 37 }],
    transferredLists: [],
    kept: [{ category: "SECURITY_EVENTS", count: 12 }],
    ...overrides,
  };
}

async function openModal(data: AccountDeletionSummaryDto) {
  server.use(
    http.get(apiUrl("/users/me/deletion-summary"), () =>
      HttpResponse.json(data),
    ),
  );
  renderWithQuery(DeleteAccountPage, {});
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: m.settings_delete_account_button() }),
  );
  await screen.findByText(m.settings_delete_account_deleted_title());
  return { user, dialog: screen.getByRole("dialog") };
}

const stepButton = (dialog: HTMLElement, title: string) =>
  within(dialog).getByRole("button", { name: new RegExp(title) });

describe("Account deletion timeline", () => {
  it("starts with every step closed, and opens one at a time", async () => {
    const { user, dialog } = await openModal(summary());

    expect(
      within(dialog)
        .queryAllByRole("button", { expanded: true })
        .filter((b) => b.closest("ol")),
    ).toHaveLength(0);
    expect(within(dialog).queryByText("412")).toBeNull();

    await user.click(
      stepButton(dialog, m.settings_delete_account_deleted_title()),
    );
    expect(
      within(dialog).getByText(m.settings_delete_account_progression()),
    ).toBeTruthy();
    expect(within(dialog).getByText("412")).toBeTruthy();

    await user.click(
      stepButton(dialog, m.settings_delete_account_anonymized_title()),
    );
    expect(within(dialog).getByText("37")).toBeTruthy();
    expect(
      stepButton(
        dialog,
        m.settings_delete_account_deleted_title(),
      ).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("only mentions handed-over lists when there are some", async () => {
    const { dialog } = await openModal(summary());

    expect(
      within(dialog).queryByText(m.settings_delete_account_step_transferred()),
    ).toBeNull();
  });

  it("names who each shared list passes to", async () => {
    const { user, dialog } = await openModal(
      summary({
        transferredLists: [{ title: "À voir ensemble", newOwner: "Camille" }],
      }),
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: new RegExp(m.settings_delete_account_step_transferred()),
      }),
    );

    expect(within(dialog).getByText("→ Camille")).toBeTruthy();
  });

  it("offers the export first, inside the app", async () => {
    const { dialog } = await openModal(summary());

    const link = within(dialog).getByRole("link", {
      name: new RegExp(m.settings_delete_account_export_title()),
    });
    expect(link.getAttribute("href")).toBe("/app/settings/export");
    expect(link.getAttribute("target")).toBeNull();
  });
});

describe("Scheduling the deletion", () => {
  beforeEach(() => {
    auth.user = {
      id: "user-1",
      email: "alice@example.com",
      deletionScheduledFor: null,
    } as UserDto;
  });

  it("sends the reason picked, then shows the date instead of the button", async () => {
    let sent: ScheduleAccountDeletionRequestDto | null = null;
    server.use(
      http.post(apiUrl("/users/me/deletion"), async ({ request }) => {
        sent = (await request.json()) as ScheduleAccountDeletionRequestDto;
        return HttpResponse.json({ scheduledFor: "2026-11-04T05:15:00.000Z" });
      }),
    );
    const { user, dialog } = await openModal(summary());

    await user.click(
      within(dialog).getByRole("button", {
        name: m.settings_delete_account_reason_privacy(),
      }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: m.settings_delete_account_confirm({ days: 14 }),
      }),
    );
    reauth.confirmed(new Date(Date.now() + 60_000).toISOString());

    await waitFor(() => expect(sent).toEqual({ reason: "PRIVACY" }));
    expect(
      await screen.findByRole("button", {
        name: m.settings_delete_account_cancel(),
      }),
    ).toBeTruthy();
    expect(auth.user?.deletionScheduledFor).toBe("2026-11-04T05:15:00.000Z");
  });

  it("asks for no reason when none is picked", async () => {
    let sent: ScheduleAccountDeletionRequestDto | null = null;
    server.use(
      http.post(apiUrl("/users/me/deletion"), async ({ request }) => {
        sent = (await request.json()) as ScheduleAccountDeletionRequestDto;
        return HttpResponse.json({ scheduledFor: "2026-11-04T05:15:00.000Z" });
      }),
    );
    const { user, dialog } = await openModal(summary());

    await user.click(
      within(dialog).getByRole("button", {
        name: m.settings_delete_account_confirm({ days: 14 }),
      }),
    );
    reauth.confirmed(new Date(Date.now() + 60_000).toISOString());

    await waitFor(() => expect(sent).toEqual({}));
  });

  it("cancels a scheduled deletion from the page", async () => {
    auth.user = {
      ...auth.user!,
      deletionScheduledFor: "2026-11-04T05:15:00.000Z",
    };
    let cancelled = false;
    server.use(
      http.delete(apiUrl("/users/me/deletion"), () => {
        cancelled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithQuery(DeleteAccountPage, {});
    const user = userEvent.setup();

    expect(
      screen.queryByRole("button", {
        name: m.settings_delete_account_button(),
      }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: m.settings_delete_account_cancel() }),
    );

    await waitFor(() => expect(cancelled).toBe(true));
    expect(auth.user?.deletionScheduledFor).toBeNull();
    expect(
      await screen.findByRole("button", {
        name: m.settings_delete_account_button(),
      }),
    ).toBeTruthy();
  });
});
