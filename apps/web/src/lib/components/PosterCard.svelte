<script lang="ts">
  // Clickable poster tile for a library entry. The line(s) under the title
  // (status/rating, progress bar, ...) vary per domain, so they're a snippet.
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import Poster from "./Poster.svelte";

  let {
    href,
    src,
    title,
    favorite = false,
    onToggleFavorite,
    meta,
  }: {
    href: string;
    src: string | null;
    title: string;
    favorite?: boolean;
    /** Toggles the entry's favorite state; omit to hide the shortcut. */
    onToggleFavorite?: (next: boolean) => void;
    meta: Snippet;
  } = $props();
</script>

<div
  class="card group hover:border-accent relative transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
  <a {href} class="absolute inset-0 z-1" aria-label={title}></a>
  <Poster {src} {title} />
  <div class="flex flex-col gap-1.5 p-3">
    <span class="font-display text-sm leading-tight font-semibold">
      {title}
    </span>
    {@render meta()}
  </div>

  {#if onToggleFavorite}
    <button
      type="button"
      onclick={() => onToggleFavorite(!favorite)}
      title={favorite
        ? m.tracking_favorite_remove()
        : m.tracking_favorite_add()}
      aria-label={favorite
        ? m.tracking_favorite_remove()
        : m.tracking_favorite_add()}
      aria-pressed={favorite}
      class="bg-surface/80 absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition-opacity {favorite
        ? 'opacity-100'
        : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'}">
      <Icon
        name="star"
        class="h-4 w-4 {favorite ? 'fill-accent text-accent' : 'text-fg'}" />
    </button>
  {/if}
</div>
