import { QueryClient } from "@tanstack/svelte-query";
import { render } from "@testing-library/svelte";
import type { Component, ComponentProps } from "svelte";
import QueryHarness from "./QueryHarness.svelte";

/**
 * Renders a component that uses the API helpers, with a fresh QueryClient so
 * no cache leaks between tests. Retries are off: a failing request must
 * surface as an error at once instead of after the app's retry backoff.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderWithQuery<C extends Component<any>>(
  component: C,
  props: ComponentProps<C>,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(QueryHarness, { props: { client, component, props } });
  return { ...result, client };
}
