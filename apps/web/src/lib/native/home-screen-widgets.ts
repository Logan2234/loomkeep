import { getHomeScreenWidgetToken } from "#lib/api/notifications.js";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";

/** apps/mobile's own plugin (HomeScreenWidgetsPlugin.kt). */
const HomeScreenWidgets = registerPlugin<{
  connect(options: { token: string }): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
}>("HomeScreenWidgets");

/** Whether the installed Android app has the home-screen widgets (an older APK doesn't). */
export const isHomeScreenWidgetsAvailable = (): boolean =>
  Capacitor.isPluginAvailable("HomeScreenWidgets");

let connected = false;

/**
 * Hands the widgets a token for this session once someone is signed in, and
 * takes it back when they sign out. A token is asked for again at each
 * start: a new sign-in is a new session, and the old token died with the
 * old one.
 */
export async function syncHomeScreenWidgets(signedIn: boolean): Promise<void> {
  if (signedIn) {
    connected = true;
    const { token } = await getHomeScreenWidgetToken();
    await HomeScreenWidgets.connect({ token });
  } else if (connected) {
    connected = false;
    await HomeScreenWidgets.disconnect();
  }
}

/**
 * Redraws the widgets whenever the app goes to the background, so what was
 * watched or tracked in it shows on the home screen right away.
 */
export function startHomeScreenWidgets(): () => void {
  const listener = App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) void HomeScreenWidgets.refresh();
  });
  return () => void listener.then((l) => l.remove());
}
