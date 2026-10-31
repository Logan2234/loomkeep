<script lang="ts">
  import { addWorkToList } from "#lib/api/lists.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { workKindLabel } from "#lib/components/chat/conversation-presentation.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domain-availability.js";
  import { m } from "#lib/paraglide/messages.js";
  import { shelves } from "#lib/search/unified-search.js";
  import { createWorkSearch } from "#lib/search/work-search.svelte.js";
  import type { WorkSearchHitDto } from "@loomkeep/shared";
  import { onMount } from "svelte";

  // "Ajouter" on a list: the unified search, compact, by domain. A pick joins
  // the list without going into the viewer's library; the field stays open
  // for the next one.
  let {
    listId,
    inList,
  }: {
    listId: string;
    /** The pages of the works already on the list. */
    inList: Set<string>;
  } = $props();

  let query = $state("");
  let highlighted = $state(0);
  let added = $state<string[]>([]);
  let results = $state<HTMLElement | null>(null);
  let field = $state<HTMLInputElement | null>(null);

  onMount(() => field?.focus());

  const search = createWorkSearch(() => query);
  const order = $derived(
    orderedDomains(auth.user?.domainOrder).filter(isDomainEnabled),
  );
  const list = $derived(
    search.enabled ? shelves(order, search.answer, search.settled) : [],
  );
  const hits = $derived(
    list.flatMap((shelf) => (shelf.state === "results" ? shelf.hits : [])),
  );

  $effect(() => {
    void hits;
    highlighted = 0;
  });

  // The list scrolls: keep the highlighted work in view.
  $effect(() => {
    void highlighted;
    results
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  });

  const isIn = (hit: WorkSearchHitDto) =>
    inList.has(hit.href) || added.includes(hit.href);

  const addMut = createApiMutation(() => ({
    mutate: (hit: WorkSearchHitDto) => addWorkToList(listId, hit.href),
    onSuccess: (_item, hit) => (added = [...added, hit.href]),
    invalidates: [keys.lists.detail(listId)],
    errorToast: true,
  }));

  function pick(hit: WorkSearchHitDto) {
    if (!isIn(hit)) addMut.mutate(hit);
  }

  function onkeydown(event: KeyboardEvent) {
    if (hits.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : hits.length - 1;
      highlighted = (highlighted + step) % hits.length;
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(hits[highlighted]);
    }
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <label
    class="border-border focus-within:border-accent mx-1 mt-1 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors">
    <Icon name="search" class="text-dim h-4 w-4 shrink-0" />
    <input
      bind:this={field}
      type="search"
      class="field min-w-0 flex-1 bg-transparent text-sm"
      enterkeyhint="search"
      placeholder={m.search_placeholder_all()}
      aria-label={m.search_placeholder_all()}
      aria-controls="list-add-results"
      autocomplete="off"
      bind:value={query}
      {onkeydown} />
  </label>

  <div
    id="list-add-results"
    bind:this={results}
    role="listbox"
    aria-label={m.common_works()}
    data-drawer-scroll
    class="min-h-0 flex-1 touch-pan-y overflow-y-auto px-1 pb-1">
    {#if !search.enabled}
      <p class="text-dim px-2 py-2 text-sm">{m.list_add_work_hint()}</p>
    {:else if search.error}
      <p class="text-danger px-2 py-2 text-sm">{search.error}</p>
    {:else if list.length === 0 && search.settled}
      <p class="text-dim px-2 py-2 text-sm">{m.common_no_results()}</p>
    {/if}

    {#each list as shelf (shelf.domain)}
      <p
        class="timecode px-2 pt-2 pb-1 text-[0.62rem] tracking-widest uppercase">
        {DOMAINS[shelf.domain].label}
      </p>
      {#if shelf.state === "results"}
        {#each shelf.hits as hit (hit.href)}
          {@const index = hits.indexOf(hit)}
          {@const already = isIn(hit)}
          <button
            type="button"
            role="option"
            aria-selected={highlighted === index}
            aria-disabled={already}
            class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150
              {highlighted === index ? 'bg-surface-2' : ''}"
            onmousedown={(e) => e.preventDefault()}
            onmouseenter={() => (highlighted = index)}
            onclick={() => pick(hit)}>
            <span class="w-[26px] shrink-0 overflow-hidden rounded">
              <Poster
                src={hit.imageUrl}
                title={hit.title}
                alt=""
                caption={false} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold"
                >{hit.title}</span>
              <span class="timecode block text-[0.68rem]">
                {workKindLabel(hit.kind)}{hit.year ? ` · ${hit.year}` : ""}
              </span>
            </span>
            {#if already}
              <span
                class="text-accent flex shrink-0 items-center gap-1 text-xs font-semibold">
                <Icon name="check" class="h-3.5 w-3.5" />
                {m.list_add_work_in_list()}
              </span>
            {:else}
              <Icon name="plus" class="text-dim h-4 w-4 shrink-0" />
            {/if}
          </button>
        {/each}
      {:else if shelf.state === "loading"}
        <div class="skeleton mx-2 my-1 h-9 rounded-lg" aria-busy="true"></div>
      {:else}
        <p class="text-dim px-2 py-1 text-xs">
          {m.search_catalog_unavailable()}
        </p>
      {/if}
    {/each}
  </div>
</div>

<style>
  /* The frame around it shows the focus, as the search page's bar does —
     a Tailwind outline utility can't beat the global :focus-visible rule. */
  .field {
    outline: none;
  }
</style>
