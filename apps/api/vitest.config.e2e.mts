import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.base.mjs";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["test/**/*.e2e-spec.ts"],
      // One shared `e2e` Postgres schema, and each spec file truncates it as it
      // boots: run the files one after another, never side by side.
      fileParallelism: false,
      globalSetup: ["./test/global-setup.js"],
      setupFiles: ["./test/e2e-env.js"],
      testTimeout: 30_000,
      coverage: {
        // Separate directory prevents unit and E2E Codecov flags from colliding.
        reportsDirectory: "./coverage-e2e",
      },
    },
  }),
);
