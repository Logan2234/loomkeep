import { layout } from "$lib/layout.svelte";
import { m } from "$lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Modal from "./Modal.svelte";

const body = createRawSnippet(() => ({
  render: () => `<div>
    <label>Name <input name="name" /></label>
    <button type="button">Save</button>
  </div>`,
}));

function renderModal(props: { dismissable?: boolean } = {}) {
  const onclose = vi.fn();
  render(Modal, {
    props: { title: "Edit list", onclose, children: body, ...props },
  });
  return { onclose, user: userEvent.setup() };
}

const focused = () => document.activeElement;
const closeCross = () =>
  within(screen.getByRole("dialog")).getByRole("button", {
    name: m.common_close(),
  });

afterEach(() => {
  layout.compact = true;
});

describe("Modal on a desktop shell", () => {
  beforeEach(() => {
    layout.compact = false;
  });

  it("is a modal dialog named by its title", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "Edit list" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("moves focus inside on opening", async () => {
    renderModal();

    await vi.waitFor(() =>
      expect(screen.getByRole("dialog").contains(focused())).toBe(true),
    );
  });

  it.each([
    [
      "Escape",
      (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}"),
    ],
    [
      "the close button",
      (user: ReturnType<typeof userEvent.setup>) => user.click(closeCross()),
    ],
    [
      "the backdrop",
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(
          document.querySelector<HTMLElement>("[data-dialog-backdrop]")!,
        ),
    ],
  ])("closes on %s", async (_, dismiss) => {
    const { onclose, user } = renderModal();

    await dismiss(user);

    expect(onclose).toHaveBeenCalledOnce();
  });

  it("can't be dismissed when it must be answered", async () => {
    const { onclose, user } = renderModal({ dismissable: false });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: m.common_close() })).toBeNull();
    expect(onclose).not.toHaveBeenCalled();
  });

  it("keeps Tab cycling inside the dialog", async () => {
    const { user } = renderModal();
    const close = closeCross();
    const save = screen.getByRole("button", { name: "Save" });
    await vi.waitFor(() => expect(focused()).toBe(close));

    save.focus();
    await user.tab();
    expect(focused()).toBe(close);

    await user.tab({ shift: true });
    expect(focused()).toBe(save);
  });

  it("makes the page behind it inert, and restores it on close", async () => {
    const page = document.createElement("main");
    document.body.append(page);
    const opener = document.createElement("button");
    page.append(opener);
    opener.focus();

    const { unmount } = render(Modal, {
      props: { title: "Edit list", onclose: vi.fn(), children: body },
    });
    expect(page.inert).toBe(true);

    unmount();

    expect(page.inert).toBe(false);
    await vi.waitFor(() => expect(focused()).toBe(opener));
    page.remove();
  });
});

describe("Modal on a compact shell", () => {
  it("becomes a bottom sheet without a close cross", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Edit list" })).toBeTruthy();
    // Only the backdrop carries the close label on a sheet.
    expect(screen.getAllByRole("button", { name: m.common_close() })).toEqual([
      document.querySelector("[data-dialog-backdrop]"),
    ]);
  });

  it.each([
    [
      "Escape",
      (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}"),
    ],
    [
      "the backdrop",
      (user: ReturnType<typeof userEvent.setup>) =>
        user.click(
          document.querySelector<HTMLElement>("[data-dialog-backdrop]")!,
        ),
    ],
  ])("closes on %s once its exit animation ends", async (_, dismiss) => {
    const { onclose, user } = renderModal();

    await dismiss(user);

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
  });

  it("can't be dismissed when it must be answered", async () => {
    const { onclose, user } = renderModal({ dismissable: false });

    await user.keyboard("{Escape}");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(document.querySelector("[data-dialog-backdrop]")?.tagName).toBe(
      "DIV",
    );
    expect(onclose).not.toHaveBeenCalled();
  });
});
