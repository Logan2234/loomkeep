<script lang="ts">
  import type { Snippet } from "svelte";

  // Shared section opener for the profile page: a mono "timecode" label
  // against a letterbox hairline, with an optional trailing action (the
  // "Gérer" links). Replaces five near-identical `<h2 class="font-display
  // ...">` headings that had drifted into slightly different markup.
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
