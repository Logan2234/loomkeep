<script lang="ts">
  import type { Snippet } from "svelte";
  let { targetId, actions }: { targetId: string; actions?: Snippet } = $props();
</script>

<div data-testid="reviews">{targetId}{@render actions?.()}</div>
