<script lang="ts">
  // The library panel's display choices as pictures of what each one looks
  // like, the way the list form pictures a collection and a ranking: the
  // four modes, then the poster size in cards mode.
  import { TABLET_QUERY } from "#lib/constants/media-queries.js";
  import { layout } from "#lib/layout.svelte.js";
  import {
    LIBRARY_VIEW_MODES,
    type LibraryPosterSize,
    type LibraryViewMode,
  } from "#lib/library-view.js";
  import { m } from "#lib/paraglide/messages.js";
  import { MediaQuery } from "svelte/reactivity";

  let {
    mode,
    onMode,
    posterSize,
    onPosterSize,
  }: {
    mode: LibraryViewMode;
    onMode: (mode: LibraryViewMode) => void;
    posterSize: LibraryPosterSize;
    onPosterSize: (size: LibraryPosterSize) => void;
  } = $props();

  // Below md the table renders as rows.
  const wide = new MediaQuery(TABLET_QUERY);

  function modeLabel(value: LibraryViewMode): string {
    switch (value) {
      case "cards":
        return m.library_view_cards();
      case "table":
        return wide.current ? m.library_view_table() : m.library_view_rows();
      case "wall":
        return m.library_view_wall();
      case "compact":
        return m.library_view_compact();
    }
  }

  const SIZES: LibraryPosterSize[] = ["large", "small"];

  // Posters per row in each picture: the phone's 2 or 3 columns, or a wide
  // screen's large and small posters.
  const perRow = $derived<Record<LibraryPosterSize, number>>(
    layout.compact ? { large: 2, small: 3 } : { large: 4, small: 6 },
  );

  function sizeLabel(size: LibraryPosterSize): string {
    if (layout.compact)
      return size === "large"
        ? m.library_columns_two()
        : m.library_columns_three();
    return size === "large"
      ? m.library_posters_large()
      : m.library_posters_small();
  }

  const OPTION =
    "flex min-w-0 flex-col gap-1.5 rounded-xl border p-1.5 text-center transition-[border-color,box-shadow,background-color] active:scale-[0.97]";
  const ON = "border-accent ring-accent bg-accent/5 ring-1";
  const OFF = "border-border hover:border-dim";
</script>

{#snippet bar(on: boolean, cls = "")}
  <span
    class="block rounded-[2px] transition-colors {on
      ? 'bg-accent/45'
      : 'bg-dim/30'} {cls}"></span>
{/snippet}

<div
  class="grid grid-cols-4 gap-2"
  role="group"
  aria-label={m.library_display()}>
  {#each LIBRARY_VIEW_MODES as value (value)}
    {@const on = mode === value}
    <button
      type="button"
      aria-pressed={on}
      class="{OPTION} {on ? ON : OFF}"
      onclick={() => onMode(value)}>
      <span
        class="bg-surface-2 flex h-14 overflow-hidden rounded-lg p-1.5"
        aria-hidden="true">
        {#if value === "cards"}
          <span class="grid w-full grid-cols-3 gap-1">
            {#each Array(3) as _, i (i)}
              <span class="flex flex-col gap-0.75">
                {@render bar(on, "flex-1")}
                {@render bar(on, "h-0.75 w-4/5 opacity-70")}
              </span>
            {/each}
          </span>
        {:else if value === "table"}
          <span class="flex w-full flex-col justify-between">
            {#each Array(3) as _, i (i)}
              <span class="flex items-center gap-1">
                {@render bar(on, "h-3 w-2 shrink-0")}
                {@render bar(on, "h-1 flex-1")}
                {@render bar(on, "h-1 w-2.5 shrink-0 opacity-70")}
              </span>
            {/each}
          </span>
        {:else if value === "wall"}
          <span class="grid w-full grid-cols-4 grid-rows-2 gap-0.5">
            {#each Array(8) as _, i (i)}
              {@render bar(on)}
            {/each}
          </span>
        {:else}
          <span class="flex w-full flex-col justify-between py-0.5">
            {#each Array(5) as _, i (i)}
              {@render bar(on, `h-1 ${i % 2 ? "w-3/4" : "w-full"}`)}
            {/each}
          </span>
        {/if}
      </span>
      <span
        class="truncate text-xs font-semibold {on
          ? 'text-accent'
          : 'text-dim'}">
        {modeLabel(value)}
      </span>
    </button>
  {/each}
</div>

{#if mode === "cards"}
  <div
    class="mt-2 grid grid-cols-2 gap-2"
    role="group"
    aria-label={m.library_poster_size()}>
    {#each SIZES as size (size)}
      {@const on = posterSize === size}
      <button
        type="button"
        aria-pressed={on}
        class="{OPTION} {on ? ON : OFF}"
        onclick={() => onPosterSize(size)}>
        <span
          class="bg-surface-2 flex h-14 items-start gap-1 overflow-hidden rounded-lg p-1.5"
          aria-hidden="true">
          {#each Array(perRow[size]) as _, i (i)}
            {@render bar(on, "aspect-2/3 flex-1")}
          {/each}
        </span>
        <span
          class="truncate text-xs font-semibold {on
            ? 'text-accent'
            : 'text-dim'}">
          {sizeLabel(size)}
        </span>
      </button>
    {/each}
  </div>
{/if}
