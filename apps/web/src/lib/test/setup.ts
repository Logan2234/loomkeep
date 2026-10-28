import { cleanup } from "@testing-library/svelte";
import "@testing-library/svelte/vitest";
import axe from "axe-core";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
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

// Browsers queue `selectionchange` as a task; happy-dom fires it on the spot,
// in the middle of whatever moved the selection. CodeMirror (the composers'
// field) reads the selection on that event and can't while it's still
// writing its own DOM, so the event goes out the way a browser sends it:
// later, and once for however many changes happened meanwhile.
const dispatch = document.dispatchEvent.bind(document);
let selectionChangeQueued = false;

document.dispatchEvent = (event: Event) => {
  if (event.type !== "selectionchange") return dispatch(event);

  if (!selectionChangeQueued) {
    selectionChangeQueued = true;
    setTimeout(() => {
      selectionChangeQueued = false;
      dispatch(event);
    });
  }

  return true;
};

// A request no test declared fails the test rather than silently hanging on
// a real network call.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Whatever state a test leaves on screen (a modal open, a wizard's third
// step, an error) gets an axe pass, which web-audit's page-by-page Pa11y never
// reaches. It runs before testing-library's own cleanup (registered first,
// so run last), and cleans up itself so a failure here doesn't leave the
// next test a second copy of the screen. WCAG A/AA rules only; contrast needs
// real layout and colours, the document-level rules have no page around a
// lone component, and iframes (the email preview's) are another document.
afterEach(async () => {
  const { violations } = await axe
    .run(document.body, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      rules: {
        "color-contrast": { enabled: false },
        "document-title": { enabled: false },
        "html-has-lang": { enabled: false },
      },
      iframes: false,
    })
    .finally(cleanup);
  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.help}\n  ${violation.nodes.map((node) => node.target.join(" ")).join("\n  ")}`,
    ),
  ).toEqual([]);
});
