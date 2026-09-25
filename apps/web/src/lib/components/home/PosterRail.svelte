<script lang="ts" generics="T">
  // The body shared by the widgets that show works: a carousel of posters
  // when there's room, a list of rows when the widget is narrow or short
  // (see sizing.ts's posterLayout). Each widget brings what goes under a
  // poster (`meta`) and the button next to it (`action`).
  import Carousel from "$lib/components/Carousel.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import type { PosterLayout } from "$lib/home/sizing";
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
    layout,
    loading,
    empty,
    image,
    meta,
    action,
    carousel = $bindable(),
  }: {
    items: T[];
    keyOf: (item: T) => string;
    info: (item: T) => ItemInfo;
    layout: PosterLayout;
    loading: boolean;
    empty: string;
    /** Replaces the poster, e.g. a list's cover collage. */
    image?: Snippet<[T]>;
    meta?: Snippet<[T]>;
    action?: Snippet<[T, "strip" | "row"]>;
    carousel?: { scrollToStart: () => void };
  } = $props();
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
      {#each { length: 6 } as _, i (i)}
        <div class="shrink-0" style:width={`${layout.posterWidth}px`}>
          <div class="skeleton aspect-2/3 w-full rounded-lg"></div>
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
          <p class="font-display mt-1.5 truncate text-xs font-semibold">
            {entry.title}
          </p>
        </svelte:element>
        {#if layout.showMeta && meta}{@render meta(item)}{/if}
        {#if layout.showAction && action}{@render action(item, "strip")}{/if}
      </div>
    {/snippet}
  </Carousel>
{:else}
  <ul class="divide-border divide-y">
    {#each items.slice(0, layout.rows) as item (keyOf(item))}
      {@const entry = info(item)}
      <li class="flex h-14 items-center gap-3">
        <svelte:element
          this={entry.href ? "a" : "div"}
          href={entry.href ?? undefined}
          class="flex min-w-0 flex-1 items-center gap-3">
          <div class="w-8 shrink-0 overflow-hidden rounded-md">
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
