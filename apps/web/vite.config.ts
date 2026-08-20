import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true, allowedHosts: ["dev.loomkeep.app"] },
  plugins: [
    tailwindcss(),
    // Only "fr" ships today (see project.inlang/settings.json) — the point
    // of adding this now is the message-extraction convention, not a second
    // language yet. No "url" strategy: this is a CSR SPA (ssr=false below)
    // with its own existing routes, not locale-prefixed ones — locale is
    // resolved client-side only (cookie, then the base locale).
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["cookie", "baseLocale"],
    }),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      env: {
        dir: "../..",
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
        start_url: "/app",
        shortcuts: [
          {
            name: "Recherche",
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
            name: "Calendrier",
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
            name: "Statistiques",
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
            name: "Mon profil",
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
            name: "Paramètres",
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
  // SSR has its own module resolution, separate from the client optimizeDeps
  // above: left to Vite's default, a linked workspace package gets inlined
  // and evaluated as ESM, which crashes on this CJS dist/ build ("exports is
  // not defined"). external forces SSR to load it the normal Node way
  // (require()), which handles CJS correctly.
  ssr: {
    external: ["@loomkeep/shared"],
  },
});
