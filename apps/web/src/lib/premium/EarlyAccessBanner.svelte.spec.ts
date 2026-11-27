import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import EarlyAccessBanner from "./EarlyAccessBanner.svelte";

const KEY = "lk-test-early-access-dismissed";
const MESSAGE = "It can be slow.";

function renderBanner() {
  renderWithQuery(EarlyAccessBanner, {
    storageKey: KEY,
    children: createRawSnippet(() => ({
      render: () => `<span>${MESSAGE}</span>`,
    })),
  });
}

beforeEach(() => localStorage.clear());

describe("EarlyAccessBanner", () => {
  it("says the domain is in early access, with the note it was given", () => {
    renderBanner();

    expect(screen.getByText(m.common_early_access())).toBeTruthy();
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it("goes away once closed, and stays away on the next visit", async () => {
    renderBanner();

    await userEvent.click(
      screen.getByRole("button", { name: m.common_close() }),
    );
    expect(screen.queryByText(MESSAGE)).toBeNull();

    // A fresh mount (a reload) reads the stored choice.
    renderBanner();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
