<script lang="ts">
  import Banner from "#lib/components/Banner.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { useQueryClient, type QueryKey } from "@tanstack/svelte-query";
  let { message, queryKey }: { message: string; queryKey: QueryKey } = $props();
  const client = useQueryClient();
  let retrying = $state(false);
  async function retry() {
    retrying = true;
    try {
      await client.refetchQueries({ queryKey });
    } finally {
      retrying = false;
    }
  }
</script>

<Banner variant="error" class="mb-4">
  <div class="flex items-center justify-between gap-3">
    <span>{message}</span>
    <button
      class="btn btn-ghost btn-sm shrink-0"
      onclick={retry}
      disabled={retrying}>
      {retrying ? m.common_loading() : m.common_retry()}
    </button>
  </div>
</Banner>
