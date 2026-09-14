import { defineConfig } from "vitest/config";

// No swc plugin, unlike apps/api's config: nothing here uses decorators or
// Nest metadata, so Vite's own esbuild transform is enough.
export default defineConfig({
  test: {
    root: "./",
    include: ["src/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      // Vitest's v8 provider defaults to text/html/clover/json — no lcov,
      // which is what Codecov's upload actually reads.
      reporter: ["lcov", "text", "html"],
    },
  },
});
