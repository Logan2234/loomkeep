import type { LibraryItemView } from "#lib/library-view.js";
import { m } from "#lib/paraglide/messages.js";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LibraryEntrySheet from "./LibraryEntrySheet.svelte";

const item: LibraryItemView = {
  href: "/app/books/1",
  title: "Dune",
  subtitle: null,
  imageUrl: null,
  status: { value: "READING", label: "Reading", cls: "" },
  ownership: "NONE",
  ownershipSource: null,
  reviewTarget: { type: "BOOK", id: "item" },
  rating: null,
  favorite: false,
  progress: null,
};

const STATUSES = [
  { value: "READING", label: "Reading" },
  { value: "READ", label: "Read" },
];

function renderSheet(overrides: Partial<Record<string, unknown>> = {}) {
  const props = {
    item,
    statusOptions: STATUSES,
    onFavorite: vi.fn(),
    onStatus: vi.fn(),
    onReview: vi.fn(),
    onSelect: vi.fn(),
    onclose: vi.fn(),
    ...overrides,
  };
  render(LibraryEntrySheet, props);
  return props;
}

describe("LibraryEntrySheet", () => {
  it("favorites the entry, then closes", async () => {
    const props = renderSheet();

    await userEvent.click(
      screen.getByRole("button", { name: m.common_favorite_add() }),
    );

    expect(props.onFavorite).toHaveBeenCalledWith(true);
    await waitFor(() => expect(props.onclose).toHaveBeenCalled());
  });

  it("changes the status", async () => {
    const props = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Read" }));

    expect(props.onStatus).toHaveBeenCalledWith("READ");
  });

  it("leaves the status alone when the current one is picked", async () => {
    const props = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Reading" }));

    expect(props.onStatus).not.toHaveBeenCalled();
  });

  it("offers no status or review for an unreleased entry", () => {
    renderSheet({ item: { ...item, upcoming: true }, statusOptions: [] });

    expect(screen.queryByRole("group", { name: m.common_status() })).toBeNull();
    expect(
      screen.queryByRole("button", { name: m.library_entry_review() }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: m.common_select() }),
    ).toBeTruthy();
  });
});
