import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: "esnext",
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    // One shared `e2e` Postgres schema, and each spec file truncates it as it
    // boots: run the files one after another, never side by side.
    fileParallelism: false,
    environment: "node",
    globalSetup: ["./test/global-setup.js"],
    setupFiles: ["./test/e2e-env.js"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // Separate directory prevents unit and E2E Codecov flags from colliding.
      reportsDirectory: "./coverage-e2e",
      include: ["src/**/*.{ts,js}"],
      reporter: ["lcov", "text", "html"],
      // The unit specs never run here: kept in, each would report at 0%.
      exclude: ["src/**/*.spec.ts"],
    },
  },
});
