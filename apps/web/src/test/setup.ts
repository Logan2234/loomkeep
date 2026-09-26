import "@testing-library/svelte/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw";

// The browser build of $env/dynamic/public reads what SvelteKit's own client
// runtime injects at boot, which never runs here.
vi.mock("$env/dynamic/public", () => ({ env: {} }));
// Its browser build imports $app/stores from outside the Vite graph, where
// that alias doesn't resolve. core.ts only reports through it.
vi.mock("@sentry/sveltekit", () => ({ captureException: vi.fn() }));

// Every transition/animate duration goes through prefersReducedMotion()
// ($lib/motion), which this class forces to true: happy-dom has no Web
// Animations API for Svelte's JS transitions to drive.
document.documentElement.classList.add("a11y-reduce-motion");

// A request no test declared fails the test rather than silently hanging on
// a real network call.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
