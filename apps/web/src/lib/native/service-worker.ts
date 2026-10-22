import { isNativeApp } from "./app-shell.js";

/**
 * Registers the PWA service worker, replacing SvelteKit's automatic
 * registration (vite.config.ts) so the Android app can skip it: the app
 * gets no Web Push, and a cached app shell would only delay updates there.
 * Installs from before that skip get theirs removed.
 */
export function registerServiceWorker(dev: boolean): void {
  if (!("serviceWorker" in navigator)) return;

  if (isNativeApp()) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        registrations.forEach((registration) => void registration.unregister()),
      );
    return;
  }

  void navigator.serviceWorker.register("/service-worker.js", {
    type: dev ? "module" : "classic",
  });
}
