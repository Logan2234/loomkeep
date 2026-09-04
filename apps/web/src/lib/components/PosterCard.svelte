<script lang="ts">
  // Clickable poster tile for a library entry. The line(s) under the title
  // (status/rating, progress bar, ...) vary per domain, so they're a snippet.
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";
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

  const reduced = prefersReducedMotion();
</script>

<div
  class="card poster-card group hover:border-accent relative overflow-hidden transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
  <!-- Projector light catching the card as the cursor passes: the "Séance"
       identity's own vocabulary, and the cheapest way to make a grid feel
       alive. Decorative, and never in the way of the link above it. -->
  <span class="poster-shine" aria-hidden="true"></span>
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
      title={favorite ? m.common_favorite_remove() : m.common_favorite_add()}
      aria-label={favorite
        ? m.common_favorite_remove()
        : m.common_favorite_add()}
      aria-pressed={favorite}
      class="bg-surface/80 absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition-opacity {favorite
        ? 'opacity-100'
        : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'}">
      {#key favorite}
        <!-- Keyed on `favorite` so the icon remounts (and pops) on every
             toggle, not just its first appearance. Transition sits on this
             wrapping span since directives can't target a component tag. -->
        <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
          <Icon
            name="star"
            class="h-4 w-4 {favorite
              ? 'fill-accent text-accent'
              : 'text-fg'}" />
        </span>
      {/key}
    </button>
  {/if}
</div>

<style>
  .poster-shine {
    position: absolute;
    inset: 0 auto 0 0;
    width: 40%;
    background: linear-gradient(
      100deg,
      transparent,
      color-mix(in srgb, var(--accent) 16%, transparent),
      transparent
    );
    transform: translateX(-160%);
    pointer-events: none;
    z-index: 2;
  }

  .poster-card:hover .poster-shine {
    animation: poster-sweep 700ms ease-out;
  }

  @keyframes poster-sweep {
    to {
      transform: translateX(360%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .poster-card:hover .poster-shine {
      animation: none;
    }
  }
</style>
