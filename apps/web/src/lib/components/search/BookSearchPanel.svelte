<script lang="ts">
  import {
    ApiError,
    fetchAllPages,
    listBooks,
    searchBooks,
    upsertBookEntry,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import { debounce } from "$lib/debounce";
  import { m } from "$lib/paraglide/messages.js";
  import type { BookEntryDto, BookSummaryDto } from "@loomkeep/shared";
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

  // Open Library's Solr parses `author:"…"` as a field-scoped query; toggling
  // this wraps the free-text query instead of adding a separate API param.
  let byAuthor = $state(false);

  let results = $state<BookSummaryDto[]>([]);
  const shown = $derived(limit ? results.slice(0, limit) : results);

  $effect(() => {
    onResults?.(results.length);
  });
  let searching = $state(false);
  let searched = $state(false);
  let searchError = $state<string | null>(null);
  let searchId = 0;
  const debouncedSearch = debounce(
    (q: string) => void runSearch(q),
    DEBOUNCE_MS,
  );

  // Books already in the library, keyed by source id → their entry, so a search
  // result can be flagged (and jumped to) instead of re-added.
  let entries = $state<BookEntryDto[]>([]);
  const tracked = $derived(
    new SvelteMap(entries.map((e) => [e.book.sourceId, e])),
  );

  async function loadLibrary() {
    try {
      entries = await fetchAllPages((page) => listBooks({ page }));
    } catch {
      // A failed library load only costs the "already added" flag; ignore.
    }
  }

  $effect(() => {
    void loadLibrary();
  });

  // Debounced catalogue search. Re-runs when the "by author" toggle changes,
  // since it changes the query sent, not just its formatting.
  $effect(() => {
    const q = query.trim();
    if (!q) {
      debouncedSearch.cancel();
      searchId++;
      results = [];
      searched = false;
      searchError = null;
      searching = false;
      return;
    }
    debouncedSearch.call(byAuthor ? `author:"${q.replace(/"/g, "")}"` : q);
    return () => debouncedSearch.cancel();
  });

  async function runSearch(q: string) {
    const mine = ++searchId;
    searching = true;
    searchError = null;
    try {
      const batch = (await searchBooks(q)).results;
      if (mine !== searchId) return;
      results = batch;
      searched = true;
    } catch (err) {
      if (mine !== searchId) return;
      searchError =
        err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) searching = false;
    }
  }

  async function addBook(book: BookSummaryDto) {
    try {
      await upsertBookEntry({
        source: book.source,
        sourceId: book.sourceId,
        status: "TO_READ",
      });
      await loadLibrary();
    } catch (err) {
      searchError = err instanceof ApiError ? err.message : "Ajout impossible";
    }
  }
</script>

{#if searchError}
  <Banner variant="error" class="mb-4">{searchError}</Banner>
{/if}

<div class="mb-4 flex flex-wrap gap-2">
  <button
    class="chip"
    class:chip-on={byAuthor}
    onclick={() => (byAuthor = !byAuthor)}>
    Par auteur
  </button>
</div>

{#if searching && results.length === 0}
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
    {#each shown as book (book.sourceId)}
      {@const entry = tracked.get(book.sourceId)}
      <div
        class="card group hover:border-accent relative flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
        <a
          href={`/app/books/${book.sourceId}`}
          class="absolute inset-0 z-1"
          aria-label={book.title}></a>
        <Poster src={book.coverUrl} title={book.title} adult={book.isAdult} />
        <div class="flex flex-1 flex-col gap-2 p-3">
          <span class="font-display text-sm leading-tight font-semibold">
            {book.title}
          </span>
          <span class="timecode text-xs">
            {#if book.authors.length > 0}
              {book.authors[0]}{#if book.year}
                &nbsp;· {book.year}{/if}
            {:else if book.year}
              {book.year}
            {:else}
              {m.common_Book()}
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
            onclick={() => addBook(book)}
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
    <p class="timecode text-sm">Aucun livre trouvé.</p>
  {:else}
    <EmptyState
      >Lance une recherche pour trouver un livre à ajouter.</EmptyState>
  {/if}
{/if}
