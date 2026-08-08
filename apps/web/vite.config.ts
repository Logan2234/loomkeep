import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },

      // adapter-node: the web app ships as a plain Node server, self-hostable in Docker.
      adapter: adapter(),
    }),
    SvelteKitPWA({
      registerType: "autoUpdate",
      // Custom service worker (src/sw.ts) so we can handle Web Push `push`
      // events; injectManifest keeps precaching the app shell for offline use.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        id: "/",
        name: "Loomkeep",
        short_name: "Loomkeep",
        description: "Self-hosted tracker for series, movies and anime",
        lang: "fr",
        dir: "ltr",
        categories: ["entertainment"],
        theme_color: "#0c0d10",
        background_color: "#0c0d10",
        display: "standalone",
        start_url: "/",
        shortcuts: [
          {
            name: "Recherche",
            url: "/search",
            icons: [
              { src: "/shortcut-search.svg", sizes: "any", type: "image/svg+xml" },
            ],
          },
          {
            name: "Calendrier",
            url: "/calendar",
            icons: [
              { src: "/shortcut-calendar.svg", sizes: "any", type: "image/svg+xml" },
            ],
          },
          {
            name: "Statistiques",
            url: "/stats",
            icons: [
              { src: "/shortcut-stats.svg", sizes: "any", type: "image/svg+xml" },
            ],
          },
          {
            name: "Mon profil",
            url: "/profile",
            icons: [
              { src: "/shortcut-profile.svg", sizes: "any", type: "image/svg+xml" },
            ],
          },
          {
            name: "Paramètres",
            url: "/settings",
            icons: [
              { src: "/shortcut-settings.svg", sizes: "any", type: "image/svg+xml" },
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
      },
    }),
  ],
  // @loomkeep/shared is a linked workspace package, so Vite treats it as
  // source and skips its usual CJS→ESM pre-bundling — but it's compiled to
  // CommonJS (consumed as dist/, see root CLAUDE.md), so named imports break
  // in dev without forcing that conversion explicitly.
  optimizeDeps: {
    include: ["@loomkeep/shared"],
  },
  build: {
    commonjsOptions: {
      include: [/@loomkeep\/shared/, /node_modules/],
    },
  },
});
