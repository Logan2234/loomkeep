<script lang="ts">
  // A premium part of a page: shown to who has it, gone for who hasn't.
  // /app/stats sums up what's missing once, in StatsPremiumBlock, rather than
  // leaving a screen of blurred walls.
  import type { Snippet } from "svelte";

  let {
    locked,
    class: className = "",
    children,
  }: { locked: boolean; class?: string; children: Snippet } = $props();
</script>

{#if !locked}
  <div class={className}>
    {@render children()}
  </div>
{/if}
