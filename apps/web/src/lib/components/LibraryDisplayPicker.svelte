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

  // Hues for the little posters, stable from one picture to the next.
  const HUES = [32, 200, 330, 150, 265, 12, 185, 48, 290, 110];

  const posterStyle = (i: number) => {
    const hue = HUES[i % HUES.length];
    return `background: linear-gradient(160deg, hsl(${hue} 58% 52%), hsl(${(hue + 35) % 360} 52% 22%))`;
  };

  // Unpicked pictures rest muted and come to colour under the pointer.
  const OPTION =
    "group flex min-w-0 flex-col gap-1.5 rounded-xl border p-1.5 text-center transition-[border-color,box-shadow,background-color,translate] duration-150 hover:-translate-y-0.5 active:scale-[0.97]";
  const ON = "border-accent ring-accent bg-accent/8 ring-1";
  const OFF = "border-border hover:border-dim";
  const PICTURE =
    "bg-bg border-border/60 relative flex h-16 overflow-hidden rounded-lg border p-1.5 transition-[filter,opacity] duration-200";
  const MUTED =
    "opacity-70 grayscale-[.7] group-hover:opacity-100 group-hover:grayscale-0";
</script>

{#snippet poster(i: number, cls = "")}
  <span
    class="block rounded-[3px] shadow-sm shadow-black/40 {cls}"
    style={posterStyle(i)}></span>
{/snippet}

{#snippet line(cls = "")}
  <span class="bg-fg/25 block h-[3px] rounded-full {cls}"></span>
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
      <span class="{PICTURE} {on ? '' : MUTED}" aria-hidden="true">
        {#if value === "cards"}
          <span class="grid w-full grid-cols-3 gap-1">
            {#each Array(3) as _, i (i)}
              <span class="flex min-w-0 flex-col gap-[3px]">
                <span class="relative flex-1">
                  {@render poster(i, "absolute inset-0")}
                  {#if i === 1}
                    <span
                      class="bg-accent absolute bottom-0 left-0 h-[2px] w-3/5 rounded-full"
                    ></span>
                  {/if}
                </span>
                {@render line("w-4/5")}
              </span>
            {/each}
          </span>
        {:else if value === "table"}
          <span class="flex w-full flex-col gap-[3px]">
            <span class="border-fg/15 flex gap-1 border-b pb-[3px]">
              {@render line("w-2/5 bg-fg/15")}
              {@render line("ml-auto w-1/5 bg-fg/15")}
            </span>
            {#each Array(3) as _, i (i)}
              <span class="flex flex-1 items-center gap-1">
                {@render poster(i + 3, "h-full w-[7px] shrink-0")}
                {@render line("flex-1")}
                <span
                  class="h-[5px] w-3 shrink-0 rounded-full {i === 0
                    ? 'bg-accent/70'
                    : 'bg-fg/20'}"></span>
              </span>
            {/each}
          </span>
        {:else if value === "wall"}
          <span class="grid w-full grid-cols-5 grid-rows-2 gap-[2px]">
            {#each Array(10) as _, i (i)}
              {@render poster(i, "h-full")}
            {/each}
          </span>
        {:else}
          <span class="divide-fg/10 flex w-full flex-col divide-y">
            {#each Array(4) as _, i (i)}
              <span class="flex flex-1 items-center gap-1">
                <span
                  class="h-[4px] w-[4px] shrink-0 rounded-full {i === 0
                    ? 'bg-accent'
                    : 'bg-fg/30'}"></span>
                {@render line(i % 2 ? "w-1/2" : "w-2/3")}
                {@render line("ml-auto w-1/5 bg-fg/15")}
              </span>
            {/each}
          </span>
        {/if}
      </span>
      <span
        class="truncate text-xs font-semibold transition-colors {on
          ? 'text-accent'
          : 'text-dim group-hover:text-fg'}">
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
        <span class="{PICTURE} {on ? '' : MUTED} gap-1" aria-hidden="true">
          {#each Array(perRow[size]) as _, i (i)}
            <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
              {@render poster(i, "aspect-2/3 w-full")}
              {@render line("w-3/4")}
            </span>
          {/each}
        </span>
        <span
          class="truncate text-xs font-semibold transition-colors {on
            ? 'text-accent'
            : 'text-dim group-hover:text-fg'}">
          {sizeLabel(size)}
        </span>
      </button>
    {/each}
  </div>
{/if}
