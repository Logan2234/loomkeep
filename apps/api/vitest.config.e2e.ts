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
    environment: "node",
    globalSetup: ["./test/global-setup.js"],
    setupFiles: ["./test/e2e-env.js"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // Separate from vitest.config.ts's ./coverage — CI uploads each as
      // its own Codecov flag (api-unit vs api-e2e), so they can't collide.
      reportsDirectory: "./coverage-e2e",
      include: ["src/**/*.{ts,js}"],
      reporter: ["lcov", "text", "html"],
    },
  },
});
