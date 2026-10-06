/// <reference lib="webworker" />
import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute([
  ...immutable.map(({ path }) => ({ url: path, revision: null })),
  ...[...assets, ...prerendered].map(({ path }) => ({
    url: path || "/",
    revision: version,
  })),
]);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Language of the server-generated text, when provided by the sender. */
  locale?: string;
}

// A "new episode" push from the API: show a notification carrying the deep link.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json() as PushPayload;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: payload.url },
      dir: "auto",
      lang: payload.locale,
      tag: "loomkeep",
    }),
  );
});

// Focus an existing tab if the app is already open, otherwise open the link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/app";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => "focus" in c);
        if (existing) {
          void existing.focus();
          return (existing as WindowClient).navigate(url);
        }
        return self.clients.openWindow(url);
      }),
  );
});
