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
