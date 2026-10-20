// Puts what the docs serve but don't own into public/ before dev and build:
// the public API's OpenAPI document (from apps/api's generate:openapi),
// Scalar's prebuilt standalone bundle, served from here rather than its
// jsDelivr default so the reference page loads nothing from a third party,
// and the fonts, at fixed paths every page can preload (see fonts.css).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const openapi = join(root, "../api/openapi-v1.json");

if (!existsSync(openapi)) {
  console.error(
    "apps/api/openapi-v1.json not found — run `pnpm --filter @loomkeep/api build && pnpm --filter @loomkeep/api generate:openapi` first.",
  );
  process.exit(1);
}

copyFileSync(openapi, join(root, "public/openapi-v1.json"));

const scalarDist = dirname(
  fileURLToPath(import.meta.resolve("@scalar/api-reference")),
);
mkdirSync(join(root, "public/scalar"), { recursive: true });
copyFileSync(
  join(scalarDist, "browser/standalone.js"),
  join(root, "public/scalar/standalone.js"),
);

const FONTS = [
  [
    import.meta.resolve("@fontsource-variable/bricolage-grotesque/package.json"),
    "bricolage-grotesque-{subset}-wght-normal.woff2",
  ],
  [
    import.meta.resolve("@fontsource-variable/hanken-grotesk/package.json"),
    "hanken-grotesk-{subset}-wght-normal.woff2",
  ],
  [
    import.meta.resolve("@fontsource/space-mono/package.json"),
    "space-mono-{subset}-400-normal.woff2",
  ],
];
mkdirSync(join(root, "public/fonts"), { recursive: true });
for (const [manifest, file] of FONTS) {
  const files = join(dirname(fileURLToPath(manifest)), "files");
  for (const subset of ["latin", "latin-ext"]) {
    const name = file.replace("{subset}", subset);
    copyFileSync(join(files, name), join(root, "public/fonts", name));
  }
}
