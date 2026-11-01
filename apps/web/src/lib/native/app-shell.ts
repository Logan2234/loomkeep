import { dismissTopmostDialog } from "#lib/actions/dialog-focus.js";
import { chat } from "#lib/chat/chat.svelte.js";
import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { readStorage } from "#lib/local-storage.js";
import { THEME_COLOR } from "#lib/theme.svelte.js";
import { goto } from "$app/navigation";
import { App } from "@capacitor/app";
import {
  Capacitor,
  registerPlugin,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";
import { isNativeBrowserAvailable, openInAppBrowser } from "./browser";
import {
  isHomeScreenWidgetsAvailable,
  startHomeScreenWidgets,
} from "./home-screen-widgets";
import { isNativePushAvailable, startNativePush } from "./push";
import { ShellTheme } from "./shell-bars";

/** Whether the page runs inside the Android app (apps/mobile), not a browser. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Android's back button: closes the open dialog first, then walks the
 * history, and at the root sends the app to the background like Android's
 * own apps do, keeping it warm for the next launch.
 */
export function handleBackButton({ canGoBack }: { canGoBack: boolean }): void {
  if (dismissTopmostDialog()) return;

  if (chat.open) {
    chat.stepBack();
    return;
  }

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

/**
 * A link leaving the instance opens in a browser tab over the app (a Chrome
 * Custom Tab), rather than sending the user out to Chrome.
 */
export function openExternalLink(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented) return;

  const url = new URL(link.href, location.href);

  if (!url.protocol.startsWith("http") || url.origin === location.origin) {
    return;
  }

  event.preventDefault();
  void openInAppBrowser(url.href);
}

/** Wires the shell's native events; returns the teardown for an `$effect`. */
export function startAppShell(): () => void {
  const listeners = Capacitor.isPluginAvailable("App")
    ? [
        App.addListener("backButton", handleBackButton),
        // Also delivers the link of a cold start, held until this listener exists.
        App.addListener("appUrlOpen", openAppLink),
      ]
    : [];
  const stopPush = isNativePushAvailable() ? startNativePush() : undefined;
  const stopWidgets = isHomeScreenWidgetsAvailable()
    ? startHomeScreenWidgets()
    : undefined;

  if (isNativeBrowserAvailable()) {
    document.addEventListener("click", openExternalLink);
  }

  return () => {
    document.removeEventListener("click", openExternalLink);
    listeners.forEach((listener) => void listener.then((l) => l.remove()));
    stopPush?.();
    stopWidgets?.();
  };
}

/** apps/mobile's own plugin (ShellSplashPlugin.java). */
const ShellSplash = registerPlugin<{ ready(): Promise<void> }>("ShellSplash");

/** The web can draw now: the app's launch screen may go. */
export function releaseShellSplash(): void {
  if (Capacitor.isPluginAvailable("ShellSplash")) {
    ShellSplash.ready().catch(() => {});
  }
}

/**
 * Light icons over the dark theme, dark ones over the light theme, on the
 * theme's own background: where the WebView doesn't draw under the bars,
 * the window shows through, and SystemBars resets it to Android's theme.
 */
export async function syncSystemBars(mode: "light" | "dark"): Promise<void> {
  await SystemBars.setStyle({
    style: mode === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });

  if (Capacitor.isPluginAvailable("ShellTheme")) {
    await ShellTheme.setBackground({
      color: THEME_COLOR[mode],
      mode,
      followsSystem: readStorage(STORAGE_KEYS.theme) === null,
    });
  }
}
