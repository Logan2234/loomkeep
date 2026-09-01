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
    include: ["src/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,js}"],
      // Vitest's v8 provider defaults to text/html/clover/json — no lcov,
      // which is what Codecov's upload actually reads.
      reporter: ["lcov", "text", "html"],
    },
  },
});
