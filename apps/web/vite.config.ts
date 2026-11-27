import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import {
  defaultClientConditions,
  defaultServerConditions,
  defineConfig,
} from "vite";

export default defineConfig(() => ({
  server: { host: true, allowedHosts: ["dev.loomkeep.app"] },
  clearScreen: false,
  plugins: [
    tailwindcss(),
    // Options in project.inlang/paraglide.config.js. Messages are served by
    // the plugin ("virtual-modules", Vite's default) rather than written one
    // file each: few requests in dev, per-message tree-shaking in the build.
    paraglideVitePlugin({ project: "./project.inlang" }),
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
          // The catalogs' CDNs, and YouTube's trailer thumbnails. Cover Art
          // Archive and Open Library redirect to archive.org's servers.
          "img-src": [
            "self",
            "data:",
            "blob:",
            "https://image.tmdb.org",
            "https://s4.anilist.co",
            "https://images.igdb.com",
            "https://covers.openlibrary.org",
            "https://coverartarchive.org",
            "https://archive.org",
            "https://*.archive.org",
            "https://i.ytimg.com",
          ],
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
  // @loomkeep/shared is read from its TypeScript source (the `source`
  // export condition, docs/adr/0007), not its compiled dist/: a change there
  // shows up on save, with nothing to rebuild. A linked workspace package,
  // it is bundled into the SSR build rather than loaded at runtime.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
}));
