<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { searchWorks } from "#lib/api/search.js";
  import { addWorkToLibrary } from "#lib/chat/work-library.js";
  import Banner from "#lib/components/Banner.svelte";
  import { workKindLabel } from "#lib/components/chat/conversation-presentation.js";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { debounce, SEARCH_DEBOUNCE_MS } from "#lib/debounce.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { shelves, statusLabel } from "#lib/search/unified-search.js";
  import type { Domain, WorkSearchHitDto } from "@loomkeep/shared";
  import { fade, fly } from "svelte/transition";

  // The "Tout" tab: one shelf per domain, a few works each, in the user's
  // domain order. A domain's own tab keeps its cards and filters.
  let {
    query,
    order,
    onseeall,
  }: {
    query: string;
    order: Domain[];
    onseeall: (domain: Domain) => void;
  } = $props();

  const MIN_LENGTH = 2;
  const reduced = prefersReducedMotion();

  let searched = $state("");
  const debounced = debounce(
    (value: string) => (searched = value),
    SEARCH_DEBOUNCE_MS,
  );
  $effect(() => debounced.call(query.trim()));

  const enabled = $derived(searched.length >= MIN_LENGTH);

  // What the instance knows answers at once; the catalogues' fuller answer
  // takes its place when it comes.
  const localQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "local"),
    fetch: () => searchWorks(searched, "local"),
    enabled,
    keepPreviousData: true,
  }));
  const allQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "all"),
    fetch: () => searchWorks(searched, "all"),
    enabled,
  }));

  const list = $derived(
    enabled
      ? shelves(
          order,
          allQuery.data ?? localQuery.data,
          allQuery.data !== undefined,
        )
      : [],
  );

  const addMut = createApiMutation(() => ({
    mutate: (hit: WorkSearchHitDto) => addWorkToLibrary(hit),
    invalidates: [["search"], ["library"]],
    errorToast: true,
  }));
</script>

{#if !enabled}
  <EmptyState>{m.search_all_hint()}</EmptyState>
{:else if allQuery.error}
  <Banner variant="error">{allQuery.error}</Banner>
{:else if list.length === 0 && allQuery.data}
  <p class="timecode text-sm">{m.common_no_results()}.</p>
{:else}
  <div class="grid gap-x-10 gap-y-7 md:grid-cols-2">
    {#each list as shelf (shelf.domain)}
      <section
        aria-labelledby="shelf-{shelf.domain}"
        class="flex min-w-0 flex-col gap-1.5"
        in:fade={{ duration: reduced ? 0 : 180 }}>
        <header class="flex items-center gap-2 px-2">
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            style:background={DOMAINS[shelf.domain].accent}></span>
          <h2 id="shelf-{shelf.domain}" class="font-display font-bold">
            {DOMAINS[shelf.domain].label}
          </h2>
          {#if shelf.state === "results"}
            <button
              type="button"
              class="text-accent hover:text-accent/80 ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-colors"
              onclick={() => onseeall(shelf.domain)}>
              {m.search_see_all()}
              <Icon name="arrow-right" class="h-3.5 w-3.5" />
            </button>
          {/if}
        </header>

        {#if shelf.state === "results"}
          <ul class="flex flex-col">
            {#each shelf.hits as hit (hit.href)}
              {@const status = statusLabel(hit)}
              <li
                in:fly={{ y: 6, duration: reduced ? 0 : 200 }}
                class="hover:bg-surface-2 relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150">
                <a
                  href={hit.href}
                  class="absolute inset-0 rounded-xl"
                  aria-label={hit.title}></a>
                <span class="overflow-hidden rounded-md">
                  <Poster
                    src={hit.imageUrl}
                    title={hit.title}
                    alt=""
                    caption={false}
                    adult={hit.isAdult} />
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-semibold">{hit.title}</span>
                  <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span class="timecode text-xs">
                      {workKindLabel(hit.kind)}{hit.year
                        ? ` · ${hit.year}`
                        : ""}
                    </span>
                    {#if status}
                      <span
                        class="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
                        >{status}</span>
                    {/if}
                  </span>
                </span>
                {#if hit.status}
                  <span
                    title={m.search_result_already_added()}
                    aria-label={m.search_result_already_added()}
                    class="bg-accent text-accent-fg relative z-10 grid h-8 w-8 place-items-center rounded-full">
                    <Icon name="check" class="h-4 w-4" />
                  </span>
                {:else}
                  <button
                    type="button"
                    title={m.search_result_add()}
                    aria-label={m.search_result_add()}
                    class="border-border text-dim hover:border-accent hover:bg-accent hover:text-accent-fg relative z-10 grid h-8 w-8 place-items-center rounded-full border transition-colors duration-150"
                    onclick={() => addMut.mutate(hit)}>
                    <Icon name="plus" class="h-4 w-4" />
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else if shelf.state === "loading"}
          <div class="flex flex-col gap-1.5" aria-busy="true">
            <div class="skeleton h-14 rounded-xl"></div>
            <div class="skeleton h-14 rounded-xl"></div>
          </div>
        {:else}
          <p class="text-dim px-2 text-sm">{m.search_catalog_unavailable()}</p>
        {/if}
      </section>
    {/each}
  </div>
{/if}
