<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";

  // "My tracking" on a game, book or album page: set-once settings (owned
  // copy, platform, private note), closed by default like the video page's.
  let { summary, children }: { summary: string; children: Snippet } = $props();

  const reduced = prefersReducedMotion();
  let expanded = $state(false);
</script>

<div
  class="border-border bg-surface mt-6 max-w-xl overflow-hidden rounded-xl border">
  <button
    type="button"
    aria-expanded={expanded}
    class="flex w-full items-center gap-2 px-4 py-3 text-left {expanded
      ? 'border-border border-b'
      : ''}"
    onclick={() => (expanded = !expanded)}>
    <Icon
      name="chevron-right"
      class="text-dim h-4 w-4 shrink-0 transition-transform {expanded
        ? 'rotate-90'
        : ''}" />
    <span class="text-sm font-semibold">{m.tracking_title()}</span>
    <span class="text-dim min-w-0 truncate text-xs">{summary}</span>
  </button>
  {#if expanded}
    <div
      class="flex flex-col gap-4 px-4 py-4"
      transition:slide|global={{ duration: reduced ? 0 : 200 }}>
      {@render children()}
    </div>
  {/if}
</div>
