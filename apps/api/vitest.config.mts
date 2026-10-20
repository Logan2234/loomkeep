import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.base.mjs";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["src/**/*.spec.ts"],
      coverage: {
        reportsDirectory: "./coverage",
      },
    },
  }),
);
