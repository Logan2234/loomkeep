import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// The sveltekit() plugin (not the full vite.config.ts stack — no PWA/
// Tailwind/paraglide-compile) is needed as soon as a test imports anything
// that touches SvelteKit's own virtual modules: $lib/* aliases, $env/*,
// $app/*. apps/lib/api/errors.spec.ts needs both ($lib/paraglide/messages
// and $env/dynamic/public via core.ts's ApiError).
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,svelte}"],
      // Vitest's v8 provider defaults to text/html/clover/json — no lcov,
      // which is what Codecov's upload actually reads.
      reporter: ["lcov", "text", "html"],
    },
  },
});
