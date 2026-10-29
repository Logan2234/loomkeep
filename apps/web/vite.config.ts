import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  server: { host: true, allowedHosts: ["dev.loomkeep.app"] },
  clearScreen: false,
  plugins: [
    tailwindcss(),
    // Keep existing routes without locale prefixes. Explicit choices win,
    // then browser preferences, with English as the base-locale fallback.
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
      // One module per locale in dev: one per message meant thousands of
      // unbundled requests on every reload. The build keeps per-message modules, which tree-shake.
      outputStructure:
        command === "serve" ? "locale-modules" : "message-modules",    }),
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
      // Enforced. SvelteKit nonces its own scripts and app.html's; every page
      // is rendered per request, so nonces work everywhere. The origins of an
      // instance's own integrations (API, Umami, GlitchTip, Unleash,
      // Quackback) come from its env at runtime: src/lib/server/csp.ts,
      // applied in hooks.server.ts, appends them to the directives below.
      csp: {
        mode: "nonce",
        directives: {
          "default-src": ["self"],
          // Turnstile (registration, when PUBLIC_TURNSTILE_SITE_KEY is set),
          // and the Web Analytics beacon Cloudflare injects into pages it
          // proxies when that's turned on in its dashboard.
          "script-src": [
            "self",
            "https://challenges.cloudflare.com",
            "https://static.cloudflareinsights.com",
          ],
          // Svelte's style: directives and transitions write inline styles.
          "style-src": ["self", "unsafe-inline"],
          // Catalog artwork comes from many CDNs (TMDB, IGDB, Open Library,
          // Cover Art Archive…) and avatars may be any URL.
          "img-src": ["self", "data:", "blob:", "https:"],
          "font-src": ["self", "data:"],
          "connect-src": ["self", "https://cloudflareinsights.com"],
          // Trailers (Lightbox) and the Turnstile challenge.
          "frame-src": [
            "self",
            "https://www.youtube-nocookie.com",
            "https://challenges.cloudflare.com",
          ],
          "object-src": ["none"],
          "base-uri": ["self"],
          "frame-ancestors": ["none"],
          "form-action": ["self"],
        },
      },
      files: { serviceWorker: "src/service-worker/service-worker" },
      // Registered by hooks.client.ts instead, which skips it in the Android app.
      serviceWorker: { register: false },
    }),

  ],
  // @loomkeep/shared is a linked workspace package, so Vite treats it as
  // source and skips its usual CJS→ESM pre-bundling — but it's compiled to
  // CommonJS (consumed as dist/, see root CLAUDE.md), so named imports break
  // in dev without forcing that conversion explicitly. The pre-bundle isn't
  // rebuilt when dist/ changes, only when the lockfile or this config does:
  // the dev script passes --force so each `pnpm dev`, which rebuilds the
  // package first, serves the current one.
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
}));
