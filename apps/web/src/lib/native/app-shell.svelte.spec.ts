import { dialogFocus } from "#lib/actions/dialog-focus.js";
import { goto } from "#lib/test/navigation.svelte.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBackButton, openAppLink, syncSystemBars } from "./app-shell";

const { minimizeApp, native, calls } = vi.hoisted(() => ({
  minimizeApp: vi.fn(() => Promise.resolve()),
  native: { plugins: new Set<string>() },
  calls: [] as string[],
}));
vi.mock("@capacitor/app", () => ({ App: { minimizeApp } }));
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capacitor/core")>()),
  Capacitor: { isPluginAvailable: (name: string) => native.plugins.has(name) },
  SystemBars: {
    setStyle: ({ style }: { style: string }) => {
      calls.push(`style ${style}`);
      return Promise.resolve();
    },
  },
  registerPlugin: () => ({
    setBackground: ({ color }: { color: string }) => {
      calls.push(`background ${color}`);
      return Promise.resolve();
    },
  }),
}));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

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

describe("App Links", () => {
  afterEach(() => goto.mockClear());

  it("routes to the page the link points at", () => {
    openAppLink({ url: `${location.origin}/app/u/logan?tab=lists#top` });

    expect(goto).toHaveBeenCalledWith("/app/u/logan?tab=lists#top");
  });

  it("ignores a link to another instance", () => {
    openAppLink({ url: "https://elsewhere.example/app" });

    expect(goto).not.toHaveBeenCalled();
  });
});

describe("system bars", () => {
  afterEach(() => {
    calls.length = 0;
    native.plugins.clear();
  });

  it("paints the window behind the bars after SystemBars resets it", async () => {
    native.plugins.add("ShellTheme");

    await syncSystemBars("dark");
    await syncSystemBars("light");

    expect(calls).toEqual([
      "style DARK",
      "background #0c0d10",
      "style LIGHT",
      "background #f7f5f3",
    ]);
  });

  it("only sets the icons on an APK without the shell theme plugin", async () => {
    await syncSystemBars("dark");

    expect(calls).toEqual(["style DARK"]);
  });
});
