<script lang="ts">
  import {
    fetchAllPages,
    listLibrary,
    searchCatalog,
    upsertLibraryEntry,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
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
  import type {
    EntryStatus,
    MediaSummaryDto,
    MediaType,
    SearchResponseDto,
  } from "@loomkeep/shared";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";

  // The search query is owned by the page and shared across domain panels.
  // `limit` caps the rendered results, disables infinite scroll, and switches
  // to compact embedded mode (no own empty-state copy — the host renders it)
  // for the library-page preview use; `onResults` reports the raw result
  // count to that host.
  // `type` is owned by the search page (the Guichet's in-bar filter menu),
  // not this panel — see BookSearchPanel's `byAuthor` for the same split.
  let {
    query,
    limit,
    onResults,
    type,
  }: {
    query: string;
    limit?: number;
    onResults?: (count: number) => void;
    type?: MediaType;
  } = $props();

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: m.media_movie(),
    SERIES: m.media_series(),
    ANIME: m.media_anime_label(),
  };

  const DEBOUNCE_MS = 300;

  // `query` (prop) is the raw input; `queryFilter` is the debounced value
  // that actually drives the fetch — type changes bypass the debounce.
  let queryFilter = $state("");

  const keyOf = (m: MediaSummaryDto) => `${m.source}:${m.sourceId}`;

  let reduced = $state(false); // prefers-reduced-motion: skip enter animation

  const debouncedQueryFilter = debounce(() => {
    queryFilter = query.trim();
  }, DEBOUNCE_MS);

  $effect(() => {
    const q = query; // track
    if (!q.trim()) {
      debouncedQueryFilter.cancel();
      queryFilter = "";
      return;
    }
    debouncedQueryFilter.call();
  });

  const searchQuery = createApiInfiniteQuery<
    SearchResponseDto,
    number,
    MediaSummaryDto
  >(() => ({
    key: keys.catalog.search({ query: queryFilter, type }),
    fetch: (pageNum) => searchCatalog(queryFilter, type, pageNum),
    getPageItems: (p) => p.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.items.length > 0 ? allPages.length + 1 : undefined,
    enabled: !!queryFilter,
    keepPreviousData: true,
  }));

  // The external catalog can return the same item across consecutive pages
  // if the underlying dataset shifts between requests — de-dupe locally,
  // keeping the first occurrence.
  const results = $derived.by(() => {
    const seen = new Set<string>();
    return searchQuery.data.filter((m) => {
      const key = keyOf(m);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const shown = $derived(limit ? results.slice(0, limit) : results);
  const searched = $derived(!!queryFilter);
  let sentinel = $state<HTMLElement | null>(null);

  $effect(() => {
    onResults?.(results.length);
  });

  // Titles already in the library, keyed by catalogue identity, so results can
  // be flagged (and their current status shown) instead of looking already-new.
  const trackKey = (t: MediaType, sourceId: string) => `${t}:${sourceId}`;

  const trackedQuery = createApiQuery(() => ({
    key: keys.library.tracked(),
    fetch: async () => {
      const entries = await fetchAllPages((page) => listLibrary({ page }));
      return new Map<string, EntryStatus>(
        entries.map((e) => [
          trackKey(e.mediaItem.type, e.mediaItem.sourceId),
          e.status,
        ]),
      );
    },
  }));
  // A failed library load only costs the "already added" flag; ignore it
  // rather than surfacing an error for a secondary, non-essential lookup.
  const tracked = $derived(trackedQuery.data ?? new Map<string, EntryStatus>());
  const trackedStatus = (m: MediaSummaryDto) =>
    tracked.get(trackKey(m.type, m.sourceId));

  const addMut = createApiMutation(() => ({
    mutate: (media: MediaSummaryDto) =>
      upsertLibraryEntry({
        source: media.source,
        sourceId: media.sourceId,
        type: media.type,
        status: "PLANNED",
      }),
    invalidates: [keys.library.tracked()],
    errorToast: true,
  }));

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) searchQuery.fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });
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
    {#each shown as media (keyOf(media))}
      {@const status = trackedStatus(media)}
      <div
        in:fly|global={{ y: 8, duration: reduced ? 0 : 220 }}
        class="card group hover:border-accent relative flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
        <a
          href={`/app/media/${media.type.toLowerCase()}/${media.sourceId}`}
          class="absolute inset-0 z-1"
          aria-label={media.title}></a>
        <Poster
          src={media.posterUrl}
          title={media.title}
          adult={media.isAdult} />
        <div class="flex flex-1 flex-col gap-1.5 p-3">
          <span class="font-display text-sm leading-tight font-semibold"
            >{media.title}</span>
          <span class="timecode text-xs">
            {TYPE_LABELS[media.type]}{#if media.year}
              &nbsp;· {media.year}{/if}
          </span>
        </div>
        {#if status}
          <span
            title={m.search_result_already_added()}
            aria-label={m.search_result_already_added()}
            class="bg-accent text-accent-fg absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full shadow">
            <Icon name="check" class="h-4 w-4" />
          </span>
        {:else}
          <button
            type="button"
            onclick={() => addMut.mutate(media)}
            title={m.search_result_add()}
            aria-label={m.search_result_add()}
            class="bg-surface/80 absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full opacity-100 backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
            <Icon name="plus" class="h-4 w-4" />
          </button>
        {/if}
      </div>
    {/each}
  </PosterGrid>

  {#if searchQuery.hasNextPage && !limit}
    <!-- Sentinel: entering the viewport triggers the next page. -->
    <div bind:this={sentinel} class="h-10"></div>
  {/if}
  {#if searchQuery.isFetchingNextPage && !limit}
    <PosterGrid>
      {#each { length: 5 } as _, i (i)}
        <div class="card flex flex-col">
          <div class="skeleton aspect-2/3 w-full"></div>
          <div class="flex flex-col gap-2 p-3">
            <div class="skeleton h-3.5 w-4/5 rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </div>
        </div>
      {/each}
    </PosterGrid>
  {/if}
{:else if !limit}
  {#if searched}
    <p class="timecode text-sm">{m.common_no_results()}.</p>
  {:else}
    <EmptyState>
      {m.search_media_hint()}
    </EmptyState>
  {/if}
{/if}
