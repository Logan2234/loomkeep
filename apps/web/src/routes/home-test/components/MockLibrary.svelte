<script lang="ts">
  // Mirrors /app/media: the search field, the filter row and the poster grid,
  // built from the same shared classes and the real PosterCard/Poster so the
  // landing shows the actual interface rather than an invented one.
  import Icon from "$lib/components/Icon.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import { LIBRARY } from "./mock-data";

  let {
    count = 12,
    chrome = true,
    gridClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
  }: {
    /** How many entries to show — the grid is cut, not paginated. */
    count?: number;
    /** Search field + filter row. Off when the surrounding layout is tight. */
    chrome?: boolean;
    /**
     * Column utilities. Breakpoints are viewport-based, so a grid rendered
     * inside a narrow frame needs its own column count.
     */
    gridClass?: string;
  } = $props();

  const entries = $derived(LIBRARY.slice(0, count));
</script>

<div>
  {#if chrome}
    <div class="relative mb-4">
      <span
        class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Icon name="search" class="h-5 w-5" />
      </span>
      <input
        type="text"
        class="input pl-10"
        placeholder="Chercher dans ma bibliothèque"
        aria-label="Chercher dans ma bibliothèque"
        readonly
        tabindex="-1" />
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      <span class="chip">Type</span>
      <span class="chip">Statut</span>
      <span class="chip inline-flex items-center gap-1">
        <Icon name="star" class="h-3.5 w-3.5" /> Favoris
      </span>
      <span class="chip sm:ml-auto">Trier : récent</span>
      <span class="chip px-2.5 font-mono">↓</span>
    </div>
  {/if}

  <div class="grid gap-4 {gridClass}">
    {#each entries as entry (entry.title)}
      <PosterCard href="/register" src={entry.cover} title={entry.title}>
        {#snippet meta()}
          {#if entry.progress !== undefined}
            <div class="bg-surface-2 h-1.5 overflow-hidden rounded-full">
              <div class="bg-accent h-full" style={`width: ${entry.progress}%`}>
              </div>
            </div>
          {/if}
          <span class="timecode text-xs">{entry.meta}</span>
        {/snippet}
      </PosterCard>
    {/each}
  </div>
</div>
