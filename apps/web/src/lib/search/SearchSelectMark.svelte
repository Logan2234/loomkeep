<script lang="ts">
  import Icon from "#lib/ui/Icon.svelte";
  import { prefersReducedMotion } from "#lib/ui/motion.js";
  import { scale } from "svelte/transition";

  // A result's tick in selection mode, where its "+" sat. The card's link
  // carries the state (aria-pressed): this is only what the eye reads.
  // Over a poster, white reads on any artwork; on a plain row it would
  // vanish in the light theme, so it takes the theme's own colours.
  let {
    on,
    class: position = "absolute top-2 right-2",
    overArtwork = true,
  }: { on: boolean; class?: string; overArtwork?: boolean } = $props();

  const reduced = prefersReducedMotion();
</script>

<span
  aria-hidden="true"
  class="pointer-events-none {position} z-10 grid h-8 w-8 place-items-center rounded-full border-2 shadow transition-colors {on
    ? 'border-accent bg-accent text-accent-fg'
    : overArtwork
      ? 'border-white bg-black/40'
      : 'border-dim bg-surface'}">
  {#if on}
    <span in:scale={{ duration: reduced ? 0 : 160, start: 0.4 }}>
      <Icon name="check" class="h-4 w-4" />
    </span>
  {/if}
</span>
