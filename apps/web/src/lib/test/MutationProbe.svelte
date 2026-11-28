<script lang="ts">
  // A bare createApiMutation behind a button, for the mutation layer's own
  // spec: the layer needs a component (useQueryClient) to run in.
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import type { Invalidation } from "#lib/api/invalidations.js";

  let {
    run,
    invalidates,
  }: { run: () => Promise<unknown>; invalidates: Invalidation } = $props();

  const mut = createApiMutation(() => ({ mutate: run, invalidates }));
</script>

<button type="button" onclick={() => mut.mutate()}>Run</button>
{#if mut.error}<p role="alert">{mut.error}</p>{/if}
