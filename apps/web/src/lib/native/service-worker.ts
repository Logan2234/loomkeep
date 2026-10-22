import { isNativeApp } from "./app-shell.js";

/**
 * Registers the PWA service worker, replacing SvelteKit's automatic
 * registration (vite.config.ts) so the Android app can skip it: the app
 * gets no Web Push, and a cached app shell would only delay updates there.
 * Installs from before that skip get theirs removed.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  if (isNativeApp()) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        registrations.forEach((registration) => void registration.unregister()),
      );
    return;
  }

  // As SvelteKit does: the built worker is an ES module, and registering
  // after load keeps it from competing with the page's own requests.
  addEventListener(
    "load",
    () => {
      void navigator.serviceWorker.register("/service-worker.js", {
        type: "module",
      });
    },
    { once: true },
  );
}
