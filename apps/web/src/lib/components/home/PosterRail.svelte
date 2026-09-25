<script lang="ts" generics="T">
  // The body shared by the widgets that show works: a carousel of posters
  // when there's room, a list of rows when the widget is narrow or short
  // (see sizing.ts's posterLayout). Each widget brings what goes under a
  // poster (`meta`) and the button next to it (`action`); both get a fixed
  // slot on every card, filled or not, so a strip's posters and buttons line
  // up whatever each work has to show.
  import Carousel from "$lib/components/Carousel.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import {
    bodyOf,
    POSTER_ACTION_HEIGHT,
    posterLayout,
    type BoxSize,
  } from "$lib/home/sizing";
  import type { Snippet } from "svelte";

  interface ItemInfo {
    href: string | null;
    title: string;
    imageUrl: string | null;
    /** Second line of a list row (an episode code, a page count…). */
    subtitle?: string;
  }

  let {
    items,
    keyOf,
    info,
    size,
    metaHeight = 0,
    stripMinWidth,
    loading,
    empty,
    label,
    image,
    meta,
    action,
    carousel = $bindable(),
  }: {
    items: T[];
    keyOf: (item: T) => string;
    info: (item: T) => ItemInfo;
    size: BoxSize;
    /** Height of the `meta` slot, in pixels. */
    metaHeight?: number;
    /** Below this body width, rows rather than posters. */
    stripMinWidth?: number;
    loading: boolean;
    empty: string;
    /** Accessible name of the strip, when it scrolls sideways. */
    label: string;
    /** Replaces the poster, e.g. a list's cover collage. */
    image?: Snippet<[T]>;
    meta?: Snippet<[T]>;
    action?: Snippet<[T, "strip" | "row"]>;
    carousel?: { scrollToStart: () => void };
  } = $props();

  // The carousel shows page dots instead of arrows on a touch screen.
  const touch =
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  const layout = $derived(
    posterLayout(bodyOf(size), {
      meta: meta ? metaHeight : 0,
      action: !!action,
      stripMinWidth,
      touch,
    }),
  );
</script>

{#snippet cover(item: T, entry: ItemInfo)}
  {#if image}
    {@render image(item)}
  {:else}
    <Poster src={entry.imageUrl} title={entry.title} />
  {/if}
{/snippet}

{#if loading}
  {#if layout.mode === "strip"}
    <div class="flex gap-3 overflow-hidden">
      {#each { length: 8 } as _, i (i)}
        <div class="shrink-0" style:width={`${layout.posterWidth}px`}>
          <div
            class="skeleton w-full rounded-lg"
            style:height={`${layout.posterHeight}px`}>
          </div>
          <div class="skeleton mt-2 h-3 w-4/5 rounded"></div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="space-y-2">
      {#each { length: layout.rows } as _, i (i)}
        <div class="flex h-12 items-center gap-3">
          <div class="skeleton h-12 w-8 shrink-0 rounded-md"></div>
          <div class="min-w-0 flex-1">
            <div class="skeleton h-3 w-4/5 rounded"></div>
            <div class="skeleton mt-2 h-2 w-1/2 rounded"></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{:else if items.length === 0}
  <p
    class="text-dim flex h-full items-center justify-center text-center text-sm">
    {empty}
  </p>
{:else if layout.mode === "strip"}
  <Carousel
    bind:this={carousel}
    {items}
    {keyOf}
    {label}
    gap="gap-3"
    wrapClass=""
    innerClass="pb-1"
    snapPad="">
    {#snippet card(item)}
      {@const entry = info(item)}
      <div style:width={`${layout.posterWidth}px`}>
        <svelte:element
          this={entry.href ? "a" : "div"}
          href={entry.href ?? undefined}
          class="block">
          <div
            class="card hover:border-accent overflow-hidden transition-[border-color]">
            {@render cover(item, entry)}
          </div>
          <p
            class="font-display mt-1.5 h-4 truncate text-xs leading-4 font-semibold">
            {entry.title}
          </p>
        </svelte:element>
        {#if layout.showMeta && meta}
          <div class="overflow-hidden" style:height={`${metaHeight}px`}>
            {@render meta(item)}
          </div>
        {/if}
        {#if layout.showAction && action}
          <div class="pt-2" style:height={`${POSTER_ACTION_HEIGHT}px`}>
            {@render action(item, "strip")}
          </div>
        {/if}
      </div>
    {/snippet}
  </Carousel>
{:else}
  {@const rows = items.slice(0, layout.rows)}
  {@const filled = rows.length === layout.rows}
  <!-- When the rows are all filled, they share the height left over rather
       than leaving it under the last one. -->
  <ul class="divide-border flex h-full flex-col divide-y">
    {#each rows as item (keyOf(item))}
      {@const entry = info(item)}
      <li class="flex items-center gap-3 {filled ? 'min-h-14 flex-1' : 'h-14'}">
        <svelte:element
          this={entry.href ? "a" : "div"}
          href={entry.href ?? undefined}
          class="flex min-w-0 flex-1 items-center gap-3">
          <div class="h-12 w-8 shrink-0 overflow-hidden rounded-md">
            {@render cover(item, entry)}
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-display truncate text-sm font-semibold">
              {entry.title}
            </p>
            {#if entry.subtitle}
              <p class="timecode truncate text-xs">{entry.subtitle}</p>
            {/if}
          </div>
        </svelte:element>
        {#if layout.showAction && action}{@render action(item, "row")}{/if}
      </li>
    {/each}
  </ul>
{/if}
