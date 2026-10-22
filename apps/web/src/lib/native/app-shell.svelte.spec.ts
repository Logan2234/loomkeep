import { dialogFocus } from "#lib/actions/dialog-focus.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBackButton } from "./app-shell";

const { minimizeApp } = vi.hoisted(() => ({
  minimizeApp: vi.fn(() => Promise.resolve()),
}));
vi.mock("@capacitor/app", () => ({ App: { minimizeApp } }));

function openDialog(onEscape?: () => void) {
  const node = document.createElement("div");
  document.body.append(node);
  const action = dialogFocus(node, { onEscape });

  return () => {
    action.destroy();
    node.remove();
  };
}

describe("Android back button", () => {
  const back = vi.spyOn(history, "back").mockImplementation(() => {});

  afterEach(() => {
    back.mockClear();
    minimizeApp.mockClear();
  });

  it("closes the topmost dialog instead of navigating", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const closeOuter = openDialog(outer);
    const closeInner = openDialog(inner);

    handleBackButton({ canGoBack: true });

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    closeInner();
    closeOuter();
  });

  it("stays put under a dialog that can't be dismissed", () => {
    const close = openDialog();

    handleBackButton({ canGoBack: true });

    expect(back).not.toHaveBeenCalled();
    expect(minimizeApp).not.toHaveBeenCalled();
    close();
  });

  it("goes back in history once no dialog is open", () => {
    openDialog(vi.fn())();

    handleBackButton({ canGoBack: true });

    expect(back).toHaveBeenCalledOnce();
  });

  it("sends the app to the background from the first page", () => {
    handleBackButton({ canGoBack: false });

    expect(minimizeApp).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });
});
