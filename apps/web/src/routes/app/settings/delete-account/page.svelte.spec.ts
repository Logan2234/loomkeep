import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { AccountDeletionSummaryDto } from "@loomkeep/shared";
import { screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import DeleteAccountPage from "./+page.svelte";

vi.mock("$app/state", async () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", async () => import("$lib/test/navigation.svelte"));

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
