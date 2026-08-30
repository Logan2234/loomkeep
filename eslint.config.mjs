import { defineConfig } from "eslint/config";
import { baseConfig } from "./eslint.config.base.mjs";

// Covers stray JS outside every workspace package's own eslint.config.mjs
// (apps/api, apps/web, packages/shared each have one and take precedence
// for their own files) — currently just .github/**/*.js CI tooling scripts,
// which pre-commit's lint-staged (a repo-wide *.{js,ts,mjs,cjs,svelte} glob)
// would otherwise fail to lint entirely: ESLint's flat config walks up from
// each file looking for a discoverable eslint.config.* and, without this,
// finds none above .github/.
export default defineConfig(
  ...baseConfig(import.meta.dirname),
  {
    // pa11y-ci's reporter loader does a plain require(path) — needs
    // CommonJS module.exports, not an ES export.
    files: [".github/pa11y/sarif-reporter.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
