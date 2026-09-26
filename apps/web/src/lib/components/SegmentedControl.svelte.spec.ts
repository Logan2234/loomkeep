import { m } from "$lib/paraglide/messages.js";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "./SegmentedControl.svelte";

// Tooltip's bubble scales in without going through prefersReducedMotion(),
// and happy-dom never finishes an animation: the bubble would never leave.
vi.mock("svelte/transition", async (importOriginal) => ({
  ...(await importOriginal<typeof import("svelte/transition")>()),
  scale: () => ({ duration: 0 }),
}));

type View = "grid" | "list" | "table";

function renderControl(
  options: {
    value: View;
    label: string;
    disabled?: boolean;
    disabledReason?: string;
    locked?: boolean;
  }[] = [
    { value: "grid", label: "Grid" },
    { value: "list", label: "List" },
  ],
  value: View = "grid",
) {
  const props = $state({
    label: "Display",
    options,
    value,
    onChange: vi.fn((next: View) => (props.value = next)),
  });
  render(SegmentedControl<View>, { props });
  return { props, user: userEvent.setup() };
}

// A locked segment is wrapped by a Tooltip that is itself a focusable
// "button", so the segment is told apart by its pressed state.
const segment = (name: string) =>
  screen
    .getAllByRole<HTMLButtonElement>("button", { name: new RegExp(name) })
    .find((element) => element.hasAttribute("aria-pressed"))!;

describe("SegmentedControl", () => {
  it("groups its segments under an accessible name", () => {
    renderControl();

    expect(screen.getByRole("group", { name: "Display" })).toBeTruthy();
  });

  it("marks only the current value as pressed", () => {
    renderControl(undefined, "list");

    expect(segment("Grid").getAttribute("aria-pressed")).toBe("false");
    expect(segment("List").getAttribute("aria-pressed")).toBe("true");
  });

  it("reports the picked segment and follows the new value", async () => {
    const { props, user } = renderControl();

    await user.click(segment("List"));

    expect(props.onChange).toHaveBeenCalledWith("list");
    expect(segment("List").getAttribute("aria-pressed")).toBe("true");
    expect(segment("Grid").getAttribute("aria-pressed")).toBe("false");
  });

  it("explains a disabled segment and won't pick it", async () => {
    const { props, user } = renderControl([
      { value: "grid", label: "Grid" },
      {
        value: "table",
        label: "Table",
        disabled: true,
        disabledReason: "Too narrow",
      },
    ]);

    const table = segment("Table");
    expect(table.disabled).toBe(true);
    expect(table.title).toBe("Too narrow");

    await user.click(table);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("shows a premium-locked segment as locked, not merely disabled", async () => {
    const { props, user } = renderControl([
      { value: "grid", label: "Grid" },
      { value: "table", label: "Table", locked: true },
    ]);

    const table = segment("Table");
    expect(table.disabled).toBe(true);
    expect(table.title).toBe("");

    // A disabled button can't take focus, so the Tooltip makes the element
    // wrapping it reachable instead — that's where the reason is read out.
    const wrapper = table.parentElement!;
    wrapper.focus();
    expect((await screen.findByRole("tooltip")).textContent?.trim()).toBe(
      m.premium_locked(),
    );
    expect(wrapper.getAttribute("aria-describedby")).toBe(
      screen.getByRole("tooltip").id,
    );

    wrapper.blur();
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    await user.click(table);
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
