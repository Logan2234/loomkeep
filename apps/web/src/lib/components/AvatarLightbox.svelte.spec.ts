import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import AvatarLightbox from "./AvatarLightbox.svelte";
describe("avatar lightbox accessibility", () => {
  it("locks document scrolling while open", () => {
    const { unmount } = render(AvatarLightbox, {
      seed: "alice",
      onClose: vi.fn(),
    });
    expect(document.documentElement.style.overflow).toBe("hidden");
    unmount();
  });
  it("moves focus inside the modal", async () => {
    render(AvatarLightbox, { seed: "alice", onClose: vi.fn() });
    await waitFor(() =>
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
        true,
      ),
    );
  });
});

it("traps Tab inside the avatar dialog and restores focus when closed", async () => {
  const rect = new DOMRect(0, 0, 10, 10);
  const geometry = vi
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([rect], { item: () => rect }));
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const { unmount } = render(AvatarLightbox, {
    seed: "alice",
    onClose: vi.fn(),
  });

  try {
    await waitFor(() =>
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
        true,
      ),
    );
    const buttons = Array.from(
      screen.getByRole("dialog").querySelectorAll<HTMLButtonElement>("button"),
    ).filter((button) => button.tabIndex >= 0);
    buttons.at(-1)!.focus();
    await fireEvent.keyDown(buttons.at(-1)!, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    await unmount();
    await waitFor(() => expect(document.activeElement).toBe(outside));
  } finally {
    unmount();
    outside.remove();
    geometry.mockRestore();
  }
});
