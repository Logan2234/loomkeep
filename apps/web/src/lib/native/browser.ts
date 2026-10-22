import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/** Whether the installed Android app can open an in-app browser tab (an older APK may not). */
export const isNativeBrowserAvailable = (): boolean =>
  Capacitor.isPluginAvailable("Browser");

/**
 * Opens a third-party page, such as an OAuth consent screen, in a browser
 * tab over the app (a Chrome Custom Tab): the WebView would hand it to
 * Chrome itself, whose redirect back would land outside the app's session.
 * That redirect to this instance comes back as an App Link instead, which
 * brings the app to the front (its singleTask activity closes the tab) and
 * routes the WebView there (openAppLink).
 */
export const openInAppBrowser = (url: string): Promise<void> =>
  Browser.open({ url });
