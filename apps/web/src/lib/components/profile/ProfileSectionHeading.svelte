<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, action }: { label: string; action?: Snippet } = $props();
</script>

<div class="mb-3 flex items-center gap-3.5">
  <span
    class="text-fg font-mono text-[11px] font-bold tracking-[0.18em] whitespace-nowrap uppercase">
    {label}
  </span>
  <span class="bg-border/70 h-px flex-1"></span>
  {#if action}{@render action()}{/if}
</div>
