import { m } from "#lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import GenericStatsShowcase from "./GenericStatsShowcase.svelte";

it("offers a reversible empty state without showing unavailable counts", async () => {
  const { container } = render(GenericStatsShowcase);
  const toggle = screen.getByRole("button", { pressed: false });
  const initialLabel = toggle.textContent;
  const user = userEvent.setup();
  await user.click(toggle);
  expect(toggle.textContent).not.toBe(initialLabel);
  const figures = container.querySelector(
    "#specimen-statfigure",
  )! as HTMLElement;
  expect(within(figures).queryByText(m.common_unavailable())).toBeNull();
  expect(within(figures).getAllByText("0")).toHaveLength(2);
  await user.click(toggle);
  expect(toggle.textContent).toBe(initialLabel);
  expect(within(figures).getByText("3")).toBeTruthy();
});
