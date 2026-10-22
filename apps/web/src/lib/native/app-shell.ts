import { dismissTopmostDialog } from "#lib/actions/dialog-focus.js";
import { App } from "@capacitor/app";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

/** Whether the page runs inside the Android app (apps/mobile), not a browser. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Android's back button: closes the open dialog first, then walks the
 * history, and at the root sends the app to the background like Android's
 * own apps do, keeping it warm for the next launch.
 */
export function handleBackButton({ canGoBack }: { canGoBack: boolean }): void {
  if (dismissTopmostDialog()) return;
  if (canGoBack) history.back();
  else void App.minimizeApp();
}

/** Wires the shell's native events; returns the teardown for an `$effect`. */
export function startAppShell(): () => void {
  const backButton = App.addListener("backButton", handleBackButton);
  return () => void backButton.then((listener) => listener.remove());
}

/** Light icons over the dark theme, dark ones over the light theme. */
export function syncSystemBars(mode: "light" | "dark"): void {
  void SystemBars.setStyle({
    style: mode === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
}
