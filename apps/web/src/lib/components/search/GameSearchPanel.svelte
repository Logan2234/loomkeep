<script lang="ts">
  import {
    ApiError,
    fetchAllPages,
    listGames,
    searchGames,
    upsertGameEntry,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import PosterGrid from "$lib/components/PosterGrid.svelte";
  import { GAME_STATUS_LABELS } from "$lib/constants/status-labels";
  import { debounce } from "$lib/debounce";
  import type { GameEntryDto, GameSummaryDto } from "@loomkeep/shared";
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
  let entries = $state<GameEntryDto[]>([]);
  const tracked = $derived(
    new SvelteMap(entries.map((e) => [e.game.sourceId, e])),
  );

  async function loadLibrary() {
    try {
      entries = await fetchAllPages((page) => listGames({ page }));
    } catch {
      // A failed library load only costs the "already added" flag; ignore.
    }
  }

  $effect(() => {
    void loadLibrary();
  });

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
      searchError =
        err instanceof ApiError ? err.message : "Recherche impossible";
    } finally {
      if (mine === searchId) searching = false;
    }
  }

  async function addGame(game: GameSummaryDto) {
    try {
      await upsertGameEntry({
        source: game.source,
        sourceId: game.sourceId,
        status: "BACKLOG",
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
      <div class="card group flex flex-col">
        <a href={`/app/games/${game.sourceId}`} class="block">
          <Poster src={game.coverUrl} title={game.title} adult={game.isAdult} />
        </a>
        <div class="flex flex-1 flex-col gap-2 p-3">
          <a
            href={`/app/games/${game.sourceId}`}
            class="font-display group-hover:text-accent text-sm leading-tight font-semibold">
            {game.title}
          </a>
          <span class="timecode text-xs">
            Jeu{#if game.year}
              · {game.year}{/if}
          </span>
          {#if entry}
            <span
              class="text-accent mt-auto inline-flex items-center gap-1 text-xs font-semibold">
              <Icon name="check" class="h-3.5 w-3.5" />
              {GAME_STATUS_LABELS[entry.status]}
            </span>
          {:else}
            <button
              class="btn btn-primary btn-sm mt-auto"
              onclick={() => addGame(game)}>
              <Icon name="plus" class="h-4 w-4" /> Ajouter
            </button>
          {/if}
        </div>
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
