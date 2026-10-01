// Puts what the docs serve but don't own into public/ before dev and build:
// the public API's OpenAPI document (from apps/api's generate:openapi) and
// Scalar's prebuilt standalone bundle, served from here rather than its
// jsDelivr default so the reference page loads nothing from a third party.
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
