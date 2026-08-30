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
    // Keep existing routes without locale prefixes. Explicit choices win,
    // then browser preferences, with English as the base-locale fallback.
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
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
      // Served by the locale-aware /manifest.webmanifest endpoint.
      manifest: false,
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
