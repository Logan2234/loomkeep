<script lang="ts">
  import {
    fetchAllPages,
    listMusic,
    searchMusic,
    upsertMusicEntry,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import { debounce } from "$lib/debounce";
  import { m } from "$lib/paraglide/messages.js";
  import type { MusicSummaryDto } from "@loomkeep/shared";
  import { SvelteMap } from "svelte/reactivity";

  // The search query is owned by the page and shared across domain panels.
  // `limit` caps the rendered results and switches to compact embedded mode
  // (no own empty-state copy — the host renders it) for the library-page
  // preview use; `onResults` reports the raw result count to that host.
  let {
    query,
    limit,
    onResults,
  }: {
    query: string;
    limit?: number;
    onResults?: (count: number) => void;
  } = $props();

  const DEBOUNCE_MS = 300;

  // `query` (raw) drives the input; `queryFilter` (debounced) drives the
  // fetch — same split as LibraryBrowser/MediaSearchPanel. A key-based query
  // already discards a stale in-flight response on its own once the key
  // moves on, so there's no manual staleness guard to maintain here.
  let queryFilter = $state("");
  const debouncedQueryFilter = debounce(() => {
    queryFilter = query.trim();
  }, DEBOUNCE_MS);

  $effect(() => {
    if (!query.trim()) {
      debouncedQueryFilter.cancel();
      queryFilter = "";
      return;
    }
    debouncedQueryFilter.call();
    return () => debouncedQueryFilter.cancel();
  });

  const searchQuery = createApiQuery(() => ({
    key: keys.music.search(queryFilter),
    fetch: () => searchMusic(queryFilter).then((r) => r.results),
    enabled: !!queryFilter,
  }));
  const results = $derived(searchQuery.data ?? []);
  const shown = $derived(limit ? results.slice(0, limit) : results);
  const searched = $derived(!!queryFilter);

  $effect(() => {
    onResults?.(results.length);
  });

  // Albums already in the library, keyed by source id → their entry, so a
  // search result can be flagged (and jumped to) instead of re-added.
  const trackedQuery = createApiQuery(() => ({
    key: keys.music.tracked(),
    fetch: () => fetchAllPages((page) => listMusic({ page })),
  }));
  // A failed library load only costs the "already added" flag; ignore it
  // rather than surfacing an error for a secondary, non-essential lookup.
  const tracked = $derived(
    new SvelteMap((trackedQuery.data ?? []).map((e) => [e.album.sourceId, e])),
  );

  const addMut = createApiMutation(() => ({
    mutate: (album: MusicSummaryDto) =>
      upsertMusicEntry({
        source: album.source,
        sourceId: album.sourceId,
        status: "TO_LISTEN",
      }),
    invalidates: [keys.music.tracked()],
    errorToast: true,
  }));

  function addAlbum(album: MusicSummaryDto) {
    addMut.mutate(album);
  }
</script>

{#if searchQuery.error}
  <Banner variant="error" class="mb-4">{searchQuery.error}</Banner>
{/if}

{#if queryFilter && searchQuery.loading}
  <PosterGrid>
    {#each { length: 10 } as _, i (i)}
      <div class="card flex flex-col">
        <div class="skeleton aspect-2/3 w-full"></div>
        <div class="flex flex-col gap-2 p-3">
          <div class="skeleton h-3.5 w-4/5 rounded"></div>
          <div class="skeleton h-3 w-1/2 rounded"></div>
        </div>
      </div>
    {/each}
  </PosterGrid>
{:else if results.length > 0}
  <PosterGrid>
    {#each shown as album (album.sourceId)}
      {@const entry = tracked.get(album.sourceId)}
      <div
        class="card group hover:border-accent relative flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
        <a
          href={`/app/music/${album.sourceId}`}
          class="absolute inset-0 z-1"
          aria-label={album.title}></a>
        <Poster src={album.coverUrl} title={album.title} />
        <div class="flex flex-1 flex-col gap-2 p-3">
          <span class="font-display text-sm leading-tight font-semibold">
            {album.title}
          </span>
          <span class="timecode text-xs">
            {#if album.artists.length > 0}
              {album.artists[0]}{#if album.year}
                &nbsp;· {album.year}{/if}
            {:else if album.year}
              {album.year}
            {:else}
              {m.music_album()}
            {/if}
          </span>
        </div>
        {#if entry}
          <span
            title={m.search_result_already_added()}
            aria-label={m.search_result_already_added()}
            class="bg-accent text-accent-fg absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full shadow">
            <Icon name="check" class="h-4 w-4" />
          </span>
        {:else}
          <button
            type="button"
            onclick={() => addAlbum(album)}
            title={m.search_result_add()}
            aria-label={m.search_result_add()}
            class="bg-surface/80 absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full opacity-100 backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
            <Icon name="plus" class="h-4 w-4" />
          </button>
        {/if}
      </div>
    {/each}
  </PosterGrid>
{:else if !limit}
  {#if searched}
    <p class="timecode text-sm">{m.search_music_empty()}</p>
  {:else}
    <EmptyState>{m.search_music_hint()}</EmptyState>
  {/if}
{/if}
