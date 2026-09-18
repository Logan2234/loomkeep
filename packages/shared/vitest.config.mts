import { defineConfig } from "vitest/config";

// No SWC plugin is needed without decorators or Nest metadata.
export default defineConfig({
  test: {
    root: "./",
    include: ["src/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      // Codecov reads lcov, which Vitest's v8 defaults omit.
      reporter: ["lcov", "text", "html"],
    },
  },
});
