<script lang="ts">
  import {
    fetchAllPages,
    listGames,
    searchGames,
    upsertGameEntry,
  } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
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
  import type { GameSummaryDto } from "@loomkeep/shared";
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

  let results = $state<GameSummaryDto[]>([]);
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

  // Games already in the library, keyed by source id → their entry, so a search
  // result can be flagged (and jumped to) instead of re-added.
  const trackedQuery = createApiQuery(() => ({
    key: keys.games.tracked(),
    fetch: () => fetchAllPages((page) => listGames({ page })),
  }));
  // A failed library load only costs the "already added" flag; ignore it
  // rather than surfacing an error for a secondary, non-essential lookup.
  const tracked = $derived(
    new SvelteMap((trackedQuery.data ?? []).map((e) => [e.game.sourceId, e])),
  );

  // Debounced catalogue search.
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
    debouncedSearch.call(q);
    return () => debouncedSearch.cancel();
  });

  async function runSearch(q: string) {
    const mine = ++searchId;
    searching = true;
    searchError = null;
    try {
      const batch = (await searchGames(q)).results;
      if (mine !== searchId) return;
      results = batch;
      searched = true;
    } catch (err) {
      if (mine !== searchId) return;
      searchError = resolveApiError(err);
    } finally {
      if (mine === searchId) searching = false;
    }
  }

  const addMut = createApiMutation(() => ({
    mutate: (game: GameSummaryDto) =>
      upsertGameEntry({
        source: game.source,
        sourceId: game.sourceId,
        status: "BACKLOG",
      }),
    invalidates: [keys.games.tracked()],
    errorToast: true,
  }));

  function addGame(game: GameSummaryDto) {
    addMut.mutate(game);
  }
</script>

{#if searchError}
  <Banner variant="error" class="mb-4">{searchError}</Banner>
{/if}

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
    {#each shown as game (game.sourceId)}
      {@const entry = tracked.get(game.sourceId)}
      <div
        class="card group hover:border-accent relative flex flex-col transition-[transform,border-color] duration-150 hover:-translate-y-0.5">
        <a
          href={`/app/games/${game.sourceId}`}
          class="absolute inset-0 z-1"
          aria-label={game.title}></a>
        <Poster src={game.coverUrl} title={game.title} adult={game.isAdult} />
        <div class="flex flex-1 flex-col gap-2 p-3">
          <span class="font-display text-sm leading-tight font-semibold">
            {game.title}
          </span>
          <span class="timecode text-xs">
            Jeu{#if game.year}
              &nbsp;· {game.year}{/if}
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
            onclick={() => addGame(game)}
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
    <p class="timecode text-sm">Aucun jeu trouvé.</p>
  {:else}
    <EmptyState>Lance une recherche pour trouver un jeu à ajouter.</EmptyState>
  {/if}
{/if}
