<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  let {
    query,
    class: className = "btn btn-ghost",
  }: {
    query: {
      isFetchingNextPage: boolean;
      fetchNextPage: () => Promise<unknown>;
    };
    class?: string;
  } = $props();
</script>

<button
  type="button"
  class={className}
  disabled={query.isFetchingNextPage}
  onclick={() => query.fetchNextPage()}
  >{query.isFetchingNextPage
    ? m.common_loading()
    : m.common_load_more()}</button>
