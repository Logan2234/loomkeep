import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { includeIgnoreFile } from "eslint/config";
import globals from "globals";
import path from "path";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");
const typeAware = process.env.ESLINT_TYPE_AWARE === "true";

/**
 * Shared flat-config base for every workspace package: JS/TS recommended
 * rules, Prettier integration, common globals, and the @stylistic formatting
 * rules — identical across apps/api, apps/web and packages/shared until now,
 * which is exactly how they drifted (a missing import in two of three files).
 * Each package's own eslint.config.mjs calls this with its own directory
 * (`projectService` needs it to find that package's tsconfig) and layers
 * package-specific config (e.g. Svelte) on top of the returned array.
 */
export function baseConfig(dirname, { browser = false } = {}) {
  return [
    includeIgnoreFile(gitignorePath),
    // Config/build files aren't part of the app tsconfig — keep them out of type-aware linting.
    { ignores: ["*.config.{js,ts,mjs,cjs}", "*.config.*.{js,ts,mjs,cjs}"] },
    js.configs.recommended,
    ts.configs.recommended,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...(browser ? globals.browser : {}),
          ...globals.node,
        },
        sourceType: "commonjs",
        parserOptions: {
          projectService: typeAware,
          tsconfigRootDir: dirname,
        },
      },
    },
    {
      rules: {
        // typescript-eslint strongly recommend that you do not use the no-undef rule on TypeScript projects.
        // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
        "no-undef": "off",
        eqeqeq: ["error", "always"],
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "prettier/prettier": ["error", { endOfLine: "auto" }],
      },
    },
    {
      files: ["**/*.{js,ts,mjs,cjs}"],
      plugins: { "@stylistic": stylistic },
      rules: {
        "@stylistic/padding-line-between-statements": [
          "warn",
          { blankLine: "always", prev: "*", next: "block-like" },
          { blankLine: "always", prev: "block-like", next: "*" },
        ],
        "@stylistic/lines-between-class-members": [
          "warn",
          "always",
          { exceptAfterSingleLine: true },
        ],
        "@stylistic/spaced-comment": ["warn", "always", { markers: ["/"] }],
        "@stylistic/no-multiple-empty-lines": [
          "warn",
          { max: 1, maxEOF: 0, maxBOF: 0 },
        ],
        "@stylistic/padded-blocks": ["warn", "never"],
        "@stylistic/multiline-comment-style": ["warn", "separate-lines"],
      },
    },
  ];
}
