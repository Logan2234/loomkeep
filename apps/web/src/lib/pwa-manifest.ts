import { m } from "./paraglide/messages.js";
import type { Locale } from "./paraglide/runtime.js";

export function createManifest(locale: Locale) {
  return {
    id: "/",
    name: "Loomkeep",
    short_name: "Loomkeep",
    description: m.pwa_description({}, { locale }),
    lang: locale,
    dir: "ltr",
    categories: ["entertainment"],
    theme_color: "#0c0d10",
    background_color: "#0c0d10",
    display: "standalone",
    start_url: "/app",
    // Android's share sheet (installed PWA only; iOS has no Web Share
    // Target). GET so the params survive the login redirect in the query.
    share_target: {
      action: "/app/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    screenshots: [
      {
        src: "/pwa-screenshot-home-desktop.jpg",
        sizes: "1265x712",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/pwa-screenshot-home-mobile.jpg",
        sizes: "375x811",
        type: "image/jpeg",
        form_factor: "narrow",
      },
      {
        src: "/pwa-screenshot-app-desktop.jpg",
        sizes: "1265x712",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/pwa-screenshot-app-mobile.jpg",
        sizes: "375x811",
        type: "image/jpeg",
        form_factor: "narrow",
      },
      {
        src: "/pwa-screenshot-search-desktop.jpg",
        sizes: "1265x712",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/pwa-screenshot-search-mobile.jpg",
        sizes: "390x843",
        type: "image/jpeg",
        form_factor: "narrow",
      },
      {
        src: "/pwa-screenshot-obsession-desktop.jpg",
        sizes: "1265x712",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/pwa-screenshot-obsession-mobile.jpg",
        sizes: "375x811",
        type: "image/jpeg",
        form_factor: "narrow",
      },
    ],
    shortcuts: [
      {
        name: m.common_search({}, { locale }),
        url: "/app/search",
        icons: [
          {
            src: "/shortcut-search.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      {
        name: m.common_calendar({}, { locale }),
        url: "/app/calendar",
        icons: [
          {
            src: "/shortcut-calendar.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      {
        name: m.common_stats({}, { locale }),
        url: "/app/stats",
        icons: [
          {
            src: "/shortcut-stats.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      {
        name: m.nav_profile({}, { locale }),
        url: "/app/profile",
        icons: [
          {
            src: "/shortcut-profile.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      {
        name: m.common_settings({}, { locale }),
        url: "/app/settings",
        icons: [
          {
            src: "/shortcut-settings.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
    ],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/pwa-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
