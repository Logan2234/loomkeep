<script lang="ts">
  // "Mon suivi" card shared by the three detail pages (books/games/media):
  // header with the favourite toggle, domain-specific body via `children`,
  // footer with the "remove from library" action.
  import type { Snippet } from "svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

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

<div
  class="border-border bg-surface mt-6 flex max-w-xl flex-col gap-4 rounded-xl border p-4">
  <!-- Block header: label + favourite pinned top-right. -->
  <div class="flex items-center justify-between gap-2">
    <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
      >{m.tracking_title()}</span>
    <button
      type="button"
      aria-pressed={favorite}
      disabled={saving}
      title={favorite
        ? m.tracking_favorite_remove()
        : m.tracking_favorite_add()}
      aria-label={favorite
        ? m.tracking_favorite_remove()
        : m.tracking_favorite_add()}
      onclick={onToggleFavorite}
      class="rounded-full p-1.5 transition-colors disabled:opacity-50 {favorite
        ? 'text-accent'
        : 'text-dim hover:bg-surface-2 hover:text-fg'}">
      <Icon name="star" class="h-5 w-5 {favorite ? 'fill-accent' : ''}" />
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
