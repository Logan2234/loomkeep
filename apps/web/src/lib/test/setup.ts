import "@testing-library/svelte/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw";

// Component tests do not receive SvelteKit's runtime environment payload.
vi.mock("$app/env/public", async () => {
  const { variables } = await import("../../env.js");
  return Object.fromEntries(
    Object.keys(variables).map((key) => [key, undefined]),
  );
});
// Component tests do not boot SvelteKit's client runtime; core.ts only
// reports through Sentry here.
vi.mock("@sentry/sveltekit", () => ({ captureException: vi.fn() }));

// Every transition/animate duration goes through prefersReducedMotion()
// (#lib/motion), which this class forces to true: happy-dom has no Web
// Animations API for Svelte's JS transitions to drive.
document.documentElement.classList.add("a11y-reduce-motion");

// A request no test declared fails the test rather than silently hanging on
// a real network call.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
