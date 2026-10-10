import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  define: {
    __LOOMKEEP_BUILD_SHA__: JSON.stringify(process.env.GIT_SHA ?? "unknown"),
  },
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
      files: { serviceWorker: "src/service-worker/service-worker" },
    }),

  ],
  // @loomkeep/shared is a linked workspace package, so Vite treats it as
  // source and skips its usual CJS→ESM pre-bundling — but it's compiled to
  // CommonJS (consumed as dist/, see root CLAUDE.md), so named imports break
  // in dev without forcing that conversion explicitly.
  optimizeDeps: {
    include: ["@loomkeep/shared", "@loomkeep/shared/observability"],
  },
  build: {
    sourcemap: true,
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
