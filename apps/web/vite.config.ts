import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Vite 6 rejects unrecognized Host headers by default — needed so the dev
    // server accepts requests forwarded through the ngrok tunnel (see README
    // "Mobile access"). Dev-only; the Docker build uses adapter-node, not this.
    allowedHosts: ["onset-collie-twiddle.ngrok-free.dev"],
    // Proxy API calls same-origin (like Caddy does for the Docker build) so
    // the browser never makes a cross-origin request to localhost:3000 —
    // avoids CORS entirely and works whether accessed via ngrok or directly.
    // Pairs with PUBLIC_API_URL=/api in apps/web/.env.
    // proxy: {
    //   "/api": { target: "http://localhost:3000", changeOrigin: true },
    // },
  },
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
        name: "Loomkeep",
        short_name: "Loomkeep",
        description: "Self-hosted tracker for series, movies and anime",
        theme_color: "#0c0d10",
        background_color: "#0c0d10",
        display: "standalone",
        start_url: "/",
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
