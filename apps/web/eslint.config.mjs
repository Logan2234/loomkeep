import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import ts from "typescript-eslint";
import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig(
  // The service worker is compiled in SvelteKit's own worker context (no DOM
  // globals); it is type-checked by svelte-check, not by this ESLint config.
  //
  // schema.d.ts is generated (openapi-typescript), gitignored, and never
  // Prettier-formatted — baseConfig's includeIgnoreFile(root .gitignore)
  // doesn't exclude it here: its patterns are root-repo-relative, but
  // ESLint resolves a config's `ignores` relative to *this* file's own
  // directory (apps/web/), so "apps/web/src/lib/api/generated/schema.d.ts"
  // effectively looks for apps/web/apps/web/... and never matches.
  { ignores: ["src/service-worker.ts", "src/lib/api/generated/schema.d.ts"] },
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
