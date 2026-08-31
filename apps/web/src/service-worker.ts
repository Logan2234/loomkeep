/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// Precache the app shell injected by vite-pwa (injectManifest strategy),
// preserving the offline behaviour the previous generateSW config provided.
precacheAndRoute(self.__WB_MANIFEST ?? []);
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
