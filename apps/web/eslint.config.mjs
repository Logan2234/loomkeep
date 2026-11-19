import paraglide from "@inlang/paraglide-js/eslint";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import path from "path";
import ts from "typescript-eslint";
import { baseConfig } from "../../eslint.config.base.mjs";

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

// initAuth applies the account's locale without a reload, after every module
// was imported: a message read at import time stays in the previous locale.
const noModuleLevelMessage = {
  meta: {
    type: "problem",
    messages: {
      eager:
        "m.{{name}}() runs once, at import, in whatever locale is active then. Read it inside a function or a getter (`get label() {...}`).",
    },
    schema: [],
  },
  create(context) {
    return {
      "CallExpression[callee.type='MemberExpression'][callee.object.name='m']"(
        node,
      ) {
        const ancestors = context.sourceCode.getAncestors(node);
        if (ancestors.some((ancestor) => FUNCTION_TYPES.has(ancestor.type)))
          return;
        context.report({
          node,
          messageId: "eager",
          data: { name: node.callee.property.name ?? "" },
        });
      },
    };
  },
};

export default defineConfig(
  // The service worker is compiled in SvelteKit's own worker context (no DOM
  // globals); it is type-checked by svelte-check, not by this ESLint config.
  { ignores: ["src/service-worker/**"] },
  // Third-party inlang plugin bundles, vendored as published.
  { ignores: ["project.inlang/plugins/**"] },
  // baseConfig's includeIgnoreFile(root .gitignore) doesn't reach
  // apps/web-local entries like this one: ESLint resolves a config's
  // `ignores` relative to *that config file's own* directory, so a
  // root-relative pattern (e.g. "apps/web/src/lib/paraglide") read from the
  // root .gitignore never matches from inside apps/web/eslint.config.mjs.
  // Reading apps/web/.gitignore here too — patterns already web-relative —
  // fixes that for every entry in it (paraglide's generated messages/, the
  // typed API client's schema.d.ts, ...) instead of listing them by hand.
  // Generated Paraglide suppressions can exceed GitHub SARIF's 25,000-result cap.
  includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),
  ...baseConfig(import.meta.dirname, { browser: true }),
  svelte.configs.recommended,
  svelte.configs.prettier,
  {
    // Static `m.key` references keep messages tree-shakable, and let
    // catalogs.spec.ts find unused keys by scanning the source.
    plugins: { paraglide },
    rules: { "paraglide/no-dynamic-message-access": "error" },
  },
  {
    // .svelte instance scripts run per component, so they're fine; plain
    // modules run once.
    files: ["**/*.ts"],
    ignores: ["**/*.spec.ts"],
    plugins: {
      loomkeep: { rules: { "no-module-level-message": noModuleLevelMessage } },
    },
    rules: { "loomkeep/no-module-level-message": "error" },
  },
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
      "no-restricted-globals": [
        "error",
        {
          name: "confirm",
          message:
            "Use ConfirmationModal instead of the native confirm dialog.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name='confirm']",
          message:
            "Use ConfirmationModal instead of the native confirm dialog.",
        },
        {
          selector:
            "CallExpression[callee.object.name='globalThis'][callee.property.name='confirm']",
          message:
            "Use ConfirmationModal instead of the native confirm dialog.",
        },
      ],
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
