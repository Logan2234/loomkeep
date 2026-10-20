import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SidePanel from "./SidePanel.svelte";

const body = createRawSnippet(() => ({
  render: () => `<div><h2 id="panel-title">Discussion</h2></div>`,
}));

function backdrop(): HTMLButtonElement {
  const outside = screen
    .getAllByRole("button", { name: m.common_close() })
    .find((button) => !button.closest('[role="dialog"]'));
  if (!outside) throw new Error("no backdrop rendered");
  return outside as HTMLButtonElement;
}

beforeEach(() => {
  layout.compact = false;
});

afterEach(() => {
  layout.compact = true;
});

describe("SidePanel", () => {
  it("closes when clicking outside the panel", async () => {
    const onclose = vi.fn();
    render(SidePanel, {
      props: { onclose, labelledby: "panel-title", children: body },
    });

    // The focus trap makes everything around the dialog inert; the backdrop
    // has to stay out of it, or the click never reaches its handler.
    expect(backdrop().inert).toBe(false);

    await userEvent.setup().click(backdrop());

    expect(onclose).toHaveBeenCalledOnce();
  });
});
