<script lang="ts">
  // "Mon suivi" card shared by the three detail pages (books/games/media):
  // header with the favourite toggle, domain-specific body via `children`,
  // footer with the "remove from library" action.
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";
  import Icon from "./Icon.svelte";

  const reduced = prefersReducedMotion();

  let {
    favorite,
    saving,
    onToggleFavorite,
    onRemove,
    children,
  }: {
    favorite: boolean;
    saving: boolean;
    onToggleFavorite: () => void;
    onRemove: () => void;
    children: Snippet;
  } = $props();
</script>

<!-- This block appearing *is* the confirmation that a work joined the
     library — before it, the page only had a button. It lands with a slight
     overshoot so the arrival registers as an event rather than a reflow. -->
<div
  class="tracking-panel border-border bg-surface mt-6 flex max-w-xl flex-col gap-4 rounded-xl border p-4 {reduced
    ? ''
    : 'tracking-panel-enter'}">
  <!-- Block header: label + favourite pinned top-right. -->
  <div class="flex items-center justify-between gap-2">
    <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
      >{m.tracking_title()}</span>
    <button
      type="button"
      aria-pressed={favorite}
      disabled={saving}
      title={favorite ? m.common_favorite_remove() : m.common_favorite_add()}
      aria-label={favorite
        ? m.common_favorite_remove()
        : m.common_favorite_add()}
      onclick={onToggleFavorite}
      class="rounded-full p-1.5 transition-colors disabled:opacity-50 {favorite
        ? 'text-accent'
        : 'text-dim hover:bg-surface-2 hover:text-fg'}">
      {#key favorite}
        <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
          <Icon name="star" class="h-5 w-5 {favorite ? 'fill-accent' : ''}" />
        </span>
      {/key}
    </button>
  </div>

  {@render children()}

  <div class="flex justify-end">
    <button
      type="button"
      class="btn-text btn-text-underline hover:text-danger text-sm"
      disabled={saving}
      onclick={onRemove}>
      {m.tracking_remove()}
    </button>
  </div>
</div>

<style>
  .tracking-panel-enter {
    animation: tracking-panel-enter 320ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes tracking-panel-enter {
    from {
      transform: scale(0.94);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
