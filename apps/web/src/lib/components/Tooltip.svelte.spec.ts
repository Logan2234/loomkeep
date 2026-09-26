import { render, screen, waitFor } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import Tooltip from "./Tooltip.svelte";

const trigger = createRawSnippet(() => ({
  render: () => `<button type="button">Share</button>`,
}));

function renderTooltip() {
  render(Tooltip, { props: { text: "Copy the link", children: trigger } });
  return screen.getByRole("button", { name: "Share" });
}

// The test setup turns on the app's reduced-motion preference
// (a11y-reduce-motion), which every transition is expected to honour.
describe("Tooltip", () => {
  it("describes its trigger while it has focus", async () => {
    const share = renderTooltip();

    share.focus();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent?.trim()).toBe("Copy the link");
    expect(share.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  it("appears and leaves without animating under reduced motion", async () => {
    const share = renderTooltip();

    share.focus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.getAnimations()).toEqual([]);

    share.blur();
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});
