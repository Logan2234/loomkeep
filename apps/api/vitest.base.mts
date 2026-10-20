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
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,js}"],
      // Codecov reads lcov, which Vitest's v8 defaults omit.
      reporter: ["lcov", "text", "html"],
      exclude: ["src/**/*.spec.ts"],
    },
  },
});
