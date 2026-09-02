import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import path from "path";
import ts from "typescript-eslint";
import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig(
  // The service worker is compiled in SvelteKit's own worker context (no DOM
  // globals); it is type-checked by svelte-check, not by this ESLint config.
  { ignores: ["src/service-worker.ts"] },
  // baseConfig's includeIgnoreFile(root .gitignore) doesn't reach
  // apps/web-local entries like this one: ESLint resolves a config's
  // `ignores` relative to *that config file's own* directory, so a
  // root-relative pattern (e.g. "apps/web/src/lib/paraglide") read from the
  // root .gitignore never matches from inside apps/web/eslint.config.mjs.
  // Reading apps/web/.gitignore here too — patterns already web-relative —
  // fixes that for every entry in it (paraglide's generated messages/, the
  // typed API client's schema.d.ts, ...) instead of listing them by hand.
  // This is what surfaced the bug: paraglide's generated files carry their
  // own inline eslint-disable, which ESLint still counts as a "suppressed
  // result" — enough of them (37788, after a recent locale expansion) to
  // get the SARIF upload rejected outright (GitHub's cap is 25000).
  includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),
  ...baseConfig(import.meta.dirname, { browser: true }),
  svelte.configs.recommended,
  svelte.configs.prettier,
  {
    rules: {
      // Crashes on plain .ts top-level declarations in this eslint-plugin-svelte
      // version (wraps core no-inner-declarations, chokes on a null upper scope).
      // https://github.com/sveltejs/eslint-plugin-svelte/issues/726
      "svelte/no-inner-declarations": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
      },
    },
  },
  {
    rules: {
      // The app navigates with plain string hrefs/goto and is served from the
      // root — adopting resolve() everywhere is base-path support (a feature),
      // not lint hygiene, so this stylistic rule doesn't fit the codebase.
      "svelte/no-navigation-without-resolve": "off",
      // Reactive collections are updated by immutable reassignment
      // (`x = new Set(x)`), and plain Date/Set are used locally in pure
      // helpers — both correct, so SvelteSet/SvelteDate aren't required.
      "svelte/prefer-svelte-reactivity": "off",
      // Allow the idiomatic `{#each { length: n } as _, i}` throwaway binding.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
