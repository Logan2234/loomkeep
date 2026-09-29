import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LibraryViewMenu from "./LibraryViewMenu.svelte";

describe("LibraryViewMenu", () => {
  it("lists the four modes, marks the current one and reports a pick", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(LibraryViewMenu, { props: { mode: "cards", onChange } });

    await user.click(
      screen.getByRole("button", { name: new RegExp(m.library_display()) }),
    );

    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      m.library_view_cards(),
      m.library_view_table(),
      m.library_view_wall(),
      m.library_view_compact(),
    ]);
    expect(items[0].getAttribute("aria-current")).toBe("true");

    await user.click(
      screen.getByRole("menuitem", { name: m.library_view_wall() }),
    );
    expect(onChange).toHaveBeenCalledWith("wall");
  });
});
