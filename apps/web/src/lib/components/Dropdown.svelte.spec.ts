import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import Dropdown from "./Dropdown.svelte";

type TriggerArgs = {
  open: boolean;
  toggle: (e: Event) => void;
  onkeydown: (e: KeyboardEvent) => void;
};

// Wired the way every caller wires it: `toggle` on click, `onkeydown` for
// the arrow keys, `open` mirrored into aria-expanded.
const trigger = createRawSnippet((args: () => TriggerArgs) => ({
  render: () => `<button type="button" aria-haspopup="menu">Actions</button>`,
  setup: (button) => {
    button.addEventListener("click", (e) => args().toggle(e));
    button.addEventListener("keydown", (e) =>
      args().onkeydown(e as KeyboardEvent),
    );
    $effect(() => {
      button.setAttribute("aria-expanded", String(args().open));
    });
  },
}));

function renderMenu() {
  const onRename = vi.fn();
  const items = createRawSnippet((args: () => { close: () => void }) => ({
    render: () => `<div>
      <button role="menuitem" type="button">Rename</button>
      <button role="menuitem" type="button" disabled>Archive</button>
      <button role="menuitem" type="button">Share</button>
      <button role="menuitem" type="button">Delete</button>
    </div>`,
    setup: (root) => {
      root.querySelector("button")!.addEventListener("click", () => {
        onRename();
        args().close();
      });
    },
  }));
  render(Dropdown, { props: { trigger, children: items } });
  return { onRename, user: userEvent.setup() };
}

const actions = () => screen.getByRole("button", { name: "Actions" });
const focused = () => document.activeElement?.textContent;

describe("Dropdown", () => {
  it("opens a menu with focus on its first item", async () => {
    const { user } = renderMenu();

    await user.click(actions());

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(actions().getAttribute("aria-expanded")).toBe("true");
    await vi.waitFor(() => expect(focused()).toBe("Rename"));
  });

  it("moves through the enabled items with the arrow keys, wrapping", async () => {
    const { user } = renderMenu();
    await user.click(actions());
    await vi.waitFor(() => expect(focused()).toBe("Rename"));

    // Archive is disabled and skipped.
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("Share");
    await user.keyboard("{End}");
    expect(focused()).toBe("Delete");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("Rename");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("Delete");
    await user.keyboard("{Home}");
    expect(focused()).toBe("Rename");
  });

  it("opens from the keyboard on the last item with ArrowUp", async () => {
    const { user } = renderMenu();
    actions().focus();

    await user.keyboard("{ArrowUp}");

    await vi.waitFor(() => expect(focused()).toBe("Delete"));
  });

  it("closes on Escape and hands focus back to its trigger", async () => {
    const { user } = renderMenu();
    await user.click(actions());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(actions()));
  });

  it("closes on a click anywhere outside", async () => {
    const { user } = renderMenu();
    await user.click(actions());

    await user.click(screen.getByRole("button", { name: m.common_close() }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when Tab moves focus out of it", async () => {
    const { user } = renderMenu();
    await user.click(actions());
    await vi.waitFor(() => expect(focused()).toBe("Rename"));

    await user.keyboard("{Tab}");

    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("closes once an item is chosen", async () => {
    const { onRename, user } = renderMenu();
    await user.click(actions());

    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("toggles closed from its trigger", async () => {
    const { user } = renderMenu();
    await user.click(actions());

    await user.click(actions());

    expect(screen.queryByRole("menu")).toBeNull();
    expect(actions().getAttribute("aria-expanded")).toBe("false");
  });
});
