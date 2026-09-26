import { vi } from "vitest";

// Stands in for both $app/state and $app/navigation, which only work inside
// a booted SvelteKit app:
//   vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
//   vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));
// `page.url` is reactive and `goto` updates it the way SvelteKit's router
// does, so an effect that navigates on its own reads still re-runs here.

let url = $state(new URL("http://localhost/"));

export const page = {
  get url() {
    return url;
  },
};

// A component that navigates in reaction to its own navigation loops on
// microtasks only, which starves every timer — including the test timeout —
// so the run would hang instead of failing.
const NAVIGATION_LOOP = 50;

export const goto = vi.fn(async (href: string) => {
  if (goto.mock.calls.length > NAVIGATION_LOOP) {
    throw new Error(`goto() called ${NAVIGATION_LOOP} times: navigation loop`);
  }

  // SvelteKit only updates `page` once the navigation resolves, never within
  // the caller's own synchronous (and possibly tracked) execution.
  await Promise.resolve();
  url = new URL(href, url);
});

/** The address the component under test starts from. */
export function visit(href: string) {
  url = new URL(href, "http://localhost");
  goto.mockClear();
}
