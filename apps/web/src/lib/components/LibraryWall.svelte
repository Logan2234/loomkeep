<script lang="ts" generics="T">
  // The wall mode of LibraryBrowser: posters only, many per row. The title
  // and status show on hover or focus; a hairline at the bottom carries the
  // progress, so nothing but the artwork takes room.
  import { joinMeta } from "$lib/format";
  import type { LibraryItemView, LibrarySelection } from "$lib/library-view";
  import { prefersReducedMotion } from "$lib/motion";
  import { flip } from "svelte/animate";
  import { fade, scale } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import Poster from "./Poster.svelte";

  let {
    items,
    keyOf,
    itemView,
    selection,
  }: {
    items: T[];
    keyOf: (entry: T) => string;
    itemView: (entry: T) => LibraryItemView;
    selection: LibrarySelection<T>;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

<div class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2 lg:grid-cols-8">
  {#each items as entry (keyOf(entry))}
    {@const item = itemView(entry)}
    {@const on = selection.active && selection.has(entry)}
    <a
      href={item.href}
      class="group relative block rounded-lg focus-visible:outline-none"
      aria-label={item.title}
      role={selection.active ? "button" : undefined}
      aria-pressed={selection.active ? on : undefined}
      data-library-item={keyOf(entry)}
      onclick={(e) => {
        if (!selection.active) return;
        e.preventDefault();
        selection.toggle(entry, e.shiftKey);
      }}
      animate:flip={{ duration: reduced ? 0 : 250 }}
      in:fade|global={{ duration: reduced ? 0 : 150 }}
      out:fade={{ duration: reduced ? 0 : 100 }}>
      <!-- Its own element: the anchor's transform belongs to animate:flip. -->
      <div
        class="group-focus-visible:ring-accent group-focus-visible:ring-offset-bg relative overflow-hidden rounded-lg transition-[transform,box-shadow] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 {on
          ? 'ring-accent ring-3'
          : ''} ease-[cubic-bezier(.34,1.56,.64,1)] group-active:scale-[0.95] group-active:duration-75 group-active:ease-out">
        <div
          class="transition-transform duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]">
          <Poster src={item.imageUrl} title={item.title} alt="" />
        </div>
        <div
          class="absolute inset-0 flex flex-col justify-end gap-0.5 bg-linear-to-b from-transparent from-30% to-black/85 p-2 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span
            class="font-display line-clamp-2 text-xs leading-tight font-bold">
            {item.title}
          </span>
          <span class="line-clamp-2 font-mono text-[0.62rem] opacity-85">
            {joinMeta(
              item.status.label,
              item.rating !== null ? `★ ${item.rating}` : null,
              item.progress?.label,
            )}
          </span>
        </div>
        {#if selection.active}
          <span
            class="absolute top-1.5 left-1.5 grid h-5 w-5 place-items-center rounded-md border-2 transition-colors {on
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-white bg-black/40'}"
            in:fade={{ duration: reduced ? 0 : 120 }}>
            {#if on}
              <span in:scale={{ duration: reduced ? 0 : 160, start: 0.4 }}>
                <Icon name="check" class="h-3 w-3" />
              </span>
            {/if}
          </span>
        {:else if item.favorite}
          <span
            class="text-accent absolute top-1.5 right-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
            <Icon name="star" class="fill-accent h-3.5 w-3.5" />
          </span>
        {/if}
        {#if item.progress && item.progress.percent < 100}
          <div class="absolute inset-x-0 bottom-0 h-0.75 bg-black/45">
            <div
              class="bg-accent h-full transition-[width] duration-500"
              style="width: {item.progress.percent}%">
            </div>
          </div>
        {/if}
      </div>
    </a>
  {/each}
</div>
