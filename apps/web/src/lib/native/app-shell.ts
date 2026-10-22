import { dismissTopmostDialog } from "#lib/actions/dialog-focus.js";
import { goto } from "$app/navigation";
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

/**
 * An App Link (MOB-08) the app was opened or resumed with: the shell always
 * starts on its own start page, so the web routes to the link itself.
 */
export function openAppLink({ url }: { url: string }): void {
  const target = new URL(url);
  if (target.origin !== location.origin) return;
  void goto(target.pathname + target.search + target.hash);
}

/** Wires the shell's native events; returns the teardown for an `$effect`. */
export function startAppShell(): () => void {
  const listeners = [
    App.addListener("backButton", handleBackButton),
    // Also delivers the link of a cold start, held until this listener exists.
    App.addListener("appUrlOpen", openAppLink),
  ];
  return () =>
    listeners.forEach((listener) => void listener.then((l) => l.remove()));
}

/** Light icons over the dark theme, dark ones over the light theme. */
export function syncSystemBars(mode: "light" | "dark"): void {
  void SystemBars.setStyle({
    style: mode === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
}
