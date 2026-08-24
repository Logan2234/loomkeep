<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { scale } from "svelte/transition";

  let { days }: { days: number | undefined } = $props();

  const reduced = prefersReducedMotion();
</script>

{#if days && days > 0}
  <span
    in:scale|global={{ duration: reduced ? 0 : 200, start: 0.6 }}
    class="text-accent inline-flex items-center gap-0.5 align-middle text-xs font-bold"
    title="{days} prise{days > 1
      ? 's'
      : ''} d'affilée — jours de suite avec un épisode ou un film vu">
    <span aria-hidden="true">🎬</span>{days}
  </span>
{/if}
