<script lang="ts">
  // useQueryClient() reads the client from a context key svelte-query keeps
  // private, so the only way to hand one to a component under test is to
  // render it inside a real provider.
  import {
    QueryClientProvider,
    type QueryClient,
  } from "@tanstack/svelte-query";
  import type { Component } from "svelte";

  let {
    client,
    component: Inner,
    props,
  }: {
    client: QueryClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any>;
    props: Record<string, unknown>;
  } = $props();
</script>

<QueryClientProvider {client}>
  <Inner {...props} />
</QueryClientProvider>
