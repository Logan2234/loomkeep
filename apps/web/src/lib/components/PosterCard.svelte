<script lang="ts">
  // A library entry as a bare poster: no frame, the progress along its bottom
  // edge, the title and the domain's meta line under it. Favorites show as a
  // star on the poster; a pointer can toggle it there, a finger goes through
  // the long-press sheet instead.
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
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
    progress = null,
    badge,
    meta,
  }: {
    href: string;
    src: string | null;
    title: string;
    favorite?: boolean;
    /** Toggles the entry's favorite state; omit to hide the shortcut. */
    onToggleFavorite?: (next: boolean) => void;
    /** Drawn along the poster's bottom edge; paused progress is dimmed. */
    progress?: { percent: number; paused?: boolean } | null;
    /** Over the poster's top-left corner, e.g. the viewer's status. */
    badge?: Snippet;
    meta: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

<div class="group relative min-w-0">
  <a
    {href}
    aria-label={title}
    class="block rounded-lg transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.97] active:duration-75 active:ease-out md:group-hover:-translate-y-0.5">
    <div class="relative overflow-hidden rounded-lg">
      <Poster {src} {title} alt="" />
      {#if badge}
        <span class="absolute top-1.5 left-1.5">{@render badge()}</span>
      {/if}
      {#if progress}
        <span class="absolute inset-x-0 bottom-0 h-0.75 bg-black/45">
          <span
            class="block h-full {progress.paused ? 'bg-dim' : 'bg-accent'}"
            style="width: {progress.percent}%"></span>
        </span>
      {/if}
      {#if favorite}
        <span
          class="text-accent absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 md:hidden">
          <Icon name="star" class="fill-accent h-3.5 w-3.5" />
        </span>
      {/if}
    </div>
  </a>
  <div class="mt-1.5 flex min-w-0 flex-col gap-0.5">
    <span class="truncate text-[0.82rem] leading-tight font-semibold">
      {title}
    </span>
    <div class="truncate leading-tight">
      {@render meta()}
    </div>
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
      class="absolute top-2 right-2 z-10 hidden h-8 w-8 place-items-center rounded-full bg-black/70 text-white transition-[opacity,transform] group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 md:grid {favorite
        ? 'opacity-100'
        : 'opacity-0'}">
      {#key favorite}
        <!-- Keyed on `favorite` so the icon remounts (and pops) on every
             toggle, not just its first appearance. Transition sits on this
             wrapping span since directives can't target a component tag. -->
        <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
          <Icon
            name="star"
            class="h-4 w-4 {favorite ? 'fill-accent text-accent' : ''}" />
        </span>
      {/key}
    </button>
  {/if}
</div>
