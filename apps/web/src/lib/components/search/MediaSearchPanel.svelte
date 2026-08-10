<script lang="ts">
  import {
    ApiError,
    fetchAllPages,
    listLibrary,
    searchCatalog,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import { debounce } from "$lib/debounce";
  import type {
    EntryStatus,
    MediaSummaryDto,
    MediaType,
  } from "@loomkeep/shared";
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { fly } from "svelte/transition";

  // The search query is owned by the page and shared across domain panels.
  // `limit` caps the rendered results, disables infinite scroll, and switches
  // to compact embedded mode (no own empty-state copy — the host renders it)
  // for the library-page preview use; `onResults` reports the raw result
  // count to that host.
  let {
    query,
    limit,
    onResults,
  }: {
    query: string;
    limit?: number;
    onResults?: (count: number) => void;
  } = $props();

  const TYPE_TABS: { label: string; value: MediaType | undefined }[] = [
    { label: "Tout", value: undefined },
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  const STATUS_LABELS: Record<EntryStatus, string> = {
    PLANNED: "À voir",
    WATCHING: "En cours",
    UP_TO_DATE: "À jour",
    COMPLETED: "Terminé",
    DROPPED: "Abandonné",
  };

  const DEBOUNCE_MS = 300;

  let type = $state<MediaType | undefined>(undefined);
  let results = $state<MediaSummaryDto[]>([]);
  const shown = $derived(limit ? results.slice(0, limit) : results);

  $effect(() => {
    onResults?.(results.length);
  });
  let searched = $state(false);
  let loading = $state(false); // fetching the first page of a new search
  let loadingMore = $state(false); // fetching a follow-up page (infinite scroll)
  let done = $state(false); // no more pages for the current search
  let error = $state<string | null>(null);

  let sentinel = $state<HTMLElement | null>(null);
  let reduced = $state(false); // prefers-reduced-motion: skip enter animation

  // Non-reactive search bookkeeping.
  let lastPage = 0; // last page number fetched for the current search
  let searchId = 0; // bumped on every reset; stale responses are discarded
  let seen = new SvelteSet<string>(); // catalogue keys already shown (cross-page dedup)
  const debouncedSearch = debounce(() => void runSearch(true), DEBOUNCE_MS);

  const keyOf = (m: MediaSummaryDto) => `${m.source}:${m.sourceId}`;

  // Titles already in the library, keyed by catalogue identity, so results can
  // be flagged (and their current status shown) instead of looking already-new.
  let tracked = $state<Map<string, EntryStatus>>(new Map());
  const trackKey = (t: MediaType, sourceId: string) => `${t}:${sourceId}`;
  const trackedStatus = (m: MediaSummaryDto) =>
    tracked.get(trackKey(m.type, m.sourceId));

  $effect(() => {
    fetchAllPages((page) => listLibrary({ page }))
      .then((entries) => {
        tracked = new SvelteMap(
          entries.map((e) => [
            trackKey(e.mediaItem.type, e.mediaItem.sourceId),
            e.status,
          ]),
        );
      })
      .catch(() => {});
  });

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  function clearResults() {
    searchId++; // invalidate any in-flight request
    lastPage = 0;
    done = false;
    seen = new SvelteSet();
    results = [];
    searched = false;
    error = null;
    loading = false;
    loadingMore = false;
  }

  /**
   * Runs the search. `reset` starts a fresh search from page 1 (new query or
   * type); otherwise it appends the next page for the infinite scroll.
   */
  async function runSearch(reset: boolean) {
    const q = query.trim();
    if (!q) {
      clearResults();
      return;
    }
    if (!reset && (loading || loadingMore || done)) return;

    if (reset) {
      searchId++;
      lastPage = 0;
      done = false;
      seen = new SvelteSet();
      results = [];
    }
    const mine = searchId;
    const next = lastPage + 1;
    if (reset) loading = true;
    else loadingMore = true;
    error = null;

    try {
      const batch = (await searchCatalog(q, type, next)).results;
      if (mine !== searchId) return; // a newer search superseded this one
      lastPage = next;
      searched = true;
      if (batch.length === 0) {
        done = true;
      } else {
        const fresh = batch.filter((m) => !seen.has(keyOf(m)));
        for (const m of fresh) seen.add(keyOf(m));
        results = [...results, ...fresh];
      }
    } catch (err) {
      if (mine !== searchId) return;
      error = err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  // Debounced live search: refetch page 1 whenever the query changes.
  $effect(() => {
    const q = query; // track the query only (type is handled eagerly below)
    if (!q.trim()) {
      debouncedSearch.cancel();
      clearResults();
      return;
    }
    debouncedSearch.call();
    return () => debouncedSearch.cancel();
  });

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  $effect(() => {
    const el = sentinel;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void runSearch(false);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  function selectType(value: MediaType | undefined) {
    if (value === type) return;
    type = value;
    debouncedSearch.cancel();
    if (query.trim())
      void runSearch(true); // eager, no debounce
    else clearResults();
  }
</script>

{#if !limit}
  <div class="mb-7 flex flex-wrap gap-2">
    {#each TYPE_TABS as tab (tab.label)}
      <button
        class="chip"
        class:chip-on={type === tab.value}
        onclick={() => selectType(tab.value)}>
        {tab.label}
      </button>
    {/each}
  </div>
{/if}

{#if error}
  <Banner variant="error" class="mb-4">{error}</Banner>
{/if}

{#if loading && results.length === 0}
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
      <a
        in:fly={{ y: 8, duration: reduced ? 0 : 220 }}
        href={`/app/media/${media.type.toLowerCase()}/${media.sourceId}`}
        class="card group hover:border-accent flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
        <div class="relative">
          <Poster
            src={media.posterUrl}
            title={media.title}
            adult={media.isAdult} />
          {#if trackedStatus(media)}
            <span
              class="bg-accent text-accent-fg absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-bold shadow">
              <Icon name="check" class="h-3 w-3" />
              {STATUS_LABELS[trackedStatus(media)!]}
            </span>
          {/if}
        </div>
        <div class="flex flex-1 flex-col gap-1.5 p-3">
          <span class="font-display text-sm leading-tight font-semibold"
            >{media.title}</span>
          <span class="timecode text-xs">
            {TYPE_LABELS[media.type]}{#if media.year}
              · {media.year}{/if}
          </span>
        </div>
      </a>
    {/each}
  </PosterGrid>

  {#if !done && !limit}
    <!-- Sentinel: entering the viewport triggers the next page. -->
    <div bind:this={sentinel} class="h-10"></div>
  {/if}
  {#if loadingMore && !limit}
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
    <p class="timecode text-sm">Aucun résultat.</p>
  {:else}
    <EmptyState>
      Lance une recherche pour trouver un film, une série ou un animé.
    </EmptyState>
  {/if}
{/if}
