<script lang="ts" module>
  import { type SelectOption } from "#lib/types/select-option.js";

  import { type SortOrder } from "@loomkeep/shared";

  import type { LibrarySagaSort } from "@loomkeep/shared";

  export interface SagaListFilters {
    query: string;
    types: string[];
    sort: LibrarySagaSort;
    order: SortOrder;
  }
</script>

<script lang="ts">
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import LibraryFiltersButton from "#lib/components/LibraryFiltersButton.svelte";
  import LibraryFiltersPanel from "#lib/components/LibraryFiltersPanel.svelte";
  import LibrarySearchField from "#lib/components/LibrarySearchField.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import { debounce, SEARCH_DEBOUNCE_MS } from "#lib/debounce.js";
  import { formatDate } from "#lib/format.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    LibrarySagasView,
    LibrarySagaView,
    SagaMemberView,
  } from "#lib/saga.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import type { Snippet } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, scale, slide } from "svelte/transition";

  type Kind = "inProgress" | "waiting" | "finished";

  // A library's sagas, whatever its domain: in progress, waiting on an
  // announced sequel, then finished. Each domain wraps it with its own
  // request, type filter and "add" action.
  let {
    modeSwitch,
    icon,
    title,
    typeOptions = [],
    queryKey,
    load,
    addKey,
    onAdd,
    addButton,
    addLabel,
    finishedHint,
    empty,
  }: {
    modeSwitch: Snippet;
    icon: IconName;
    title: string;
    /** A type filter, for a domain whose sagas come in several kinds. */
    typeOptions?: SelectOption[];
    queryKey: (filters: SagaListFilters) => readonly unknown[];
    load: (filters: SagaListFilters) => Promise<LibrarySagasView>;
    /** What to refetch once a work is added. */
    addKey: readonly unknown[];
    onAdd: (member: SagaMemberView) => Promise<unknown>;
    /** The add button's text: the domain's to-do status. */
    addButton: string;
    addLabel: (title: string) => string;
    finishedHint: string;
    empty: string;
  } = $props();

  const reduced = prefersReducedMotion();
  const ms = (duration: number) => (reduced ? 0 : duration);

  // Only the filters a saga can answer: a saga has no status or favourite of
  // its own, so those stay with the works view.
  const SORTS: SelectOption<LibrarySagaSort>[] = [
    { label: m.media_sagas_sort_recent(), value: "recent" },
    { label: m.common_title(), value: "title" },
    { label: m.common_progress(), value: "progress" },
  ];

  const DEFAULT_SORT: LibrarySagaSort = "recent";

  let query = $state("");
  let appliedQuery = $state("");
  let types = $state<string[]>([]);
  let sort = $state<string>(DEFAULT_SORT);
  let reversed = $state(false);
  const applyQuery = debounce(() => (appliedQuery = query), SEARCH_DEBOUNCE_MS);

  let filtersOpen = $state(false);
  // On a phone the search hides behind a magnifier, as in the works view.
  let searchOpen = $state(false);
  let searchInput = $state<HTMLInputElement | null>(null);

  function setQuery(value: string) {
    query = value;
    applyQuery.call();
  }

  function openSearch() {
    searchOpen = true;
    requestAnimationFrame(() => searchInput?.focus());
  }

  // Hiding the field also drops its query: no filter left out of sight.
  function closeSearch() {
    searchOpen = false;
    setQuery("");
  }

  function resetFilters() {
    types = [];
    sort = DEFAULT_SORT;
    reversed = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [role=dialog]")) return;
    if (e.key === "/" && !layout.compact && searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  }

  const sortLabel = $derived(
    SORTS.find((option) => option.value === sort)?.label ?? sort,
  );

  // The panel's type filter, kept in sight on the toolbar and removable
  // without opening it.
  const tokens = $derived(
    types.map((type) => ({
      key: type,
      label: typeOptions.find((o) => o.value === type)?.label ?? type,
      remove: () => (types = types.filter((t) => t !== type)),
    })),
  );

  const filters = $derived<SagaListFilters>({
    query: appliedQuery.trim(),
    types,
    sort: sort as LibrarySagaSort,
    // Titles read A to Z by default, the rest most-first.
    order: (sort === "title") !== reversed ? "asc" : "desc",
  });
  const filtered = $derived(filters.query !== "" || types.length > 0);

  const sagasQuery = createApiQuery(() => ({
    key: queryKey(filters),
    fetch: () => load(filters),
  }));
  const inProgress = $derived(sagasQuery.data?.inProgress ?? []);
  const waiting = $derived(sagasQuery.data?.waiting ?? []);
  const finished = $derived(sagasQuery.data?.finished ?? []);
  const ongoing = $derived(inProgress.length + waiting.length);
  const total = $derived(ongoing + finished.length);
  // Folded by default: what's done shouldn't push aside what's left to see.
  let showFinished = $state(false);

  const addMut = createApiMutation(() => ({
    mutate: onAdd,
    invalidates: [addKey],
    errorToast: true,
  }));

  // The work a row leads to: what comes next, or the last one of a
  // finished saga.
  const focusOf = (saga: LibrarySagaView) => saga.next ?? saga.members.at(-1)!;

  // The posters up to that work, last four: the run so far, ending on it.
  const stackOf = (saga: LibrarySagaView) => {
    const until = saga.members.findIndex((x) => x.id === focusOf(saga).id);
    return saga.members.slice(Math.max(0, until - 3), until + 1);
  };
</script>

{#snippet sagaRow(saga: LibrarySagaView, kind: Kind)}
  {@const focus = focusOf(saga)}
  <div
    role="listitem"
    class="group hover:bg-surface-2/60 relative grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-4 transition-colors sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
    <div class="relative h-[4.25rem]" aria-hidden="true">
      {#each stackOf(saga) as member, i (member.id)}
        <div
          class="saga-card absolute top-0 w-11 shadow-lg {member.seen
            ? 'brightness-75 saturate-50'
            : ''}"
          style:left={`${i * 0.75}rem`}
          style:z-index={10 - i}
          style:--spread={`${i * 0.3}rem`}
          style:--tilt={`${i * 2.5}deg`}>
          <Poster
            src={member.posterUrl}
            title={member.title}
            alt=""
            caption={false} />
        </div>
      {/each}
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <p class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
        <!-- Stretched over the row: the row leads to the next work. -->
        <a
          href={focus.href}
          class="font-display focus-visible:after:outline-accent truncate text-lg font-bold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2">
          {saga.title}
        </a>
        {#if saga.kind}
          <span class="timecode text-micro shrink-0 uppercase">
            {saga.kind}
          </span>
        {/if}
      </p>
      <div class="flex gap-0.5" aria-hidden="true">
        {#each saga.members as member (member.id)}
          <span
            class="h-2 flex-1 rounded-sm transition-colors duration-500 {member.segmentClass}"
          ></span>
        {/each}
      </div>
      <p class="text-dim truncate text-sm">
        {#if saga.next}
          {kind === "waiting"
            ? m.media_sagas_next_release({ title: saga.next.title })
            : m.media_sagas_next({ title: saga.next.title })}
          {#if saga.next.meta}
            <span class="timecode text-xs">· {saga.next.meta}</span>
          {/if}
        {:else if saga.finishedAt}
          {m.media_sagas_finished_on({ date: formatDate(saga.finishedAt) })}
        {:else}
          {m.library_status_completed()}
        {/if}
      </p>
    </div>

    <div
      class="relative z-10 col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
      <span class="font-mono text-xl font-bold tabular-nums">
        {saga.seen}<span class="text-dim">/{saga.released}</span>
      </span>
      {#key saga.next?.badge?.status}
        <div in:scale={{ start: 0.7, duration: ms(220), easing: cubicOut }}>
          {#if !saga.next}
            <!-- Nothing left to add: the count says it all. -->
          {:else if saga.next.badge}
            <TrackingStatusBadge {...saga.next.badge} />
          {:else if kind === "waiting"}
            <span
              class="border-border text-dim inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-bold">
              <Icon name="calendar" class="h-3.5 w-3.5" />
              {m.media_saga_upcoming()}
            </span>
          {:else}
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              aria-label={addLabel(saga.next.title)}
              disabled={addMut.loading}
              onclick={() => saga.next && addMut.mutate(saga.next)}>
              <Icon name="plus" class="h-3.5 w-3.5" />
              {addButton}
            </button>
          {/if}
        </div>
      {/key}
    </div>
  </div>
{/snippet}

{#snippet section(
  heading: string,
  hint: string,
  sagas: LibrarySagaView[],
  kind: Kind,
)}
  {#if sagas.length > 0}
    <section
      class="flex flex-col gap-3"
      in:fly={{ y: 10, duration: ms(260), easing: cubicOut }}>
      <div class="flex items-baseline gap-3">
        <h2 class="font-display text-xl font-bold whitespace-nowrap">
          {heading}
        </h2>
        <span class="timecode hidden text-xs sm:inline">{hint}</span>
      </div>
      <div
        role="list"
        aria-label={heading}
        class="card divide-border divide-y {kind === 'waiting'
          ? 'opacity-90'
          : kind === 'finished'
            ? 'opacity-75'
            : ''}">
        {#each sagas as saga (saga.key)}
          {@render sagaRow(saga, kind)}
        {/each}
      </div>
    </section>
  {/if}
{/snippet}

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    back="/app"
    backInHistory
    backOnPhoneOnly
    {icon}
    {title}
    subtitle={sagasQuery.data
      ? total === 1
        ? m.media_sagas_count_one({ count: total })
        : m.media_sagas_count_many({ count: total })
      : undefined}
    actions={pageActions}
    class="mb-4 md:mb-6" />

  {#if layout.compact && searchOpen}
    <div class="mb-3 flex" transition:slide={{ duration: ms(180) }}>
      {@render searchField()}
    </div>
  {/if}

  <!-- Under the phone's compact title bar once the header scrolls away. -->
  <div
    class="bg-bg sticky z-20 -mx-5 px-5 py-2 md:-mx-8 md:px-8"
    style:top={layout.compact
      ? "calc(env(safe-area-inset-top) + 3rem)"
      : "0px"}>
    <div class="flex items-center gap-2">
      <div
        class="no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
        {#each tokens as token (token.key)}
          <button
            type="button"
            class="bg-accent/14 text-accent hover:bg-accent/22 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pr-1 pl-3 text-[0.8rem] font-semibold transition-colors"
            aria-label={m.library_remove_filter({ label: token.label })}
            in:scale={{ duration: ms(160), start: 0.9 }}
            onclick={token.remove}>
            {token.label}
            <span class="grid h-6 w-6 place-items-center">
              <Icon name="x" class="h-3.5 w-3.5" />
            </span>
          </button>
        {/each}
      </div>
      {#if layout.compact}
        <button
          type="button"
          class="btn-icon h-9 w-9 rounded-full {searchOpen
            ? 'bg-accent/14 text-accent hover:bg-accent/22 hover:text-accent'
            : ''}"
          aria-label={m.library_filter_placeholder()}
          aria-pressed={searchOpen}
          onclick={() => (searchOpen ? closeSearch() : openSearch())}>
          <Icon name="search" class="h-5 w-5" />
        </button>
      {/if}
      <LibraryFiltersButton
        count={types.length}
        expanded={filtersOpen}
        onclick={() => (filtersOpen = true)} />
    </div>
  </div>

  {#if layout.compact}
    <div class="mb-3"></div>
  {:else}
    <button
      type="button"
      class="timecode hover:text-fg mt-1 mb-4 text-xs transition-colors"
      onclick={() => (filtersOpen = true)}>
      {m.library_sorted_by({ sort: sortLabel.toLowerCase() })}
      {reversed ? "↑" : "↓"}
    </button>
  {/if}

  {#if sagasQuery.error}
    <Banner variant="error">{sagasQuery.error}</Banner>
  {:else if sagasQuery.loading && !sagasQuery.data}
    <div class="card divide-border divide-y" aria-hidden="true">
      {#each [0, 1, 2] as i (i)}
        <div class="flex items-center gap-5 px-5 py-4">
          <div class="bg-surface-2 h-16 w-24 animate-pulse rounded-md"></div>
          <div class="flex flex-1 flex-col gap-2">
            <div class="bg-surface-2 h-4 w-1/3 animate-pulse rounded"></div>
            <div class="bg-surface-2 h-2 w-full animate-pulse rounded"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col gap-9">
      {#if ongoing === 0}
        <EmptyState art={filtered ? undefined : "list"}>
          {filtered ? m.media_sagas_empty_filtered() : empty}
        </EmptyState>
      {/if}
      {@render section(
        m.media_sagas_in_progress(),
        m.media_sagas_in_progress_hint(),
        inProgress,
        "inProgress",
      )}
      {@render section(
        m.media_sagas_waiting(),
        m.media_sagas_waiting_hint(),
        waiting,
        "waiting",
      )}
      {#if finished.length > 0}
        <div class="flex flex-col gap-9">
          <!-- Centred so it reads as something to unfold, kept quiet so it
               doesn't compete with what's left to see. -->
          <div class="flex items-center gap-3">
            <span class="bg-border h-px flex-1" aria-hidden="true"></span>
            <button
              type="button"
              class="text-dim hover:text-fg inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors"
              aria-expanded={showFinished}
              onclick={() => (showFinished = !showFinished)}>
              {showFinished
                ? m.media_sagas_hide_finished()
                : m.media_sagas_show_finished({ count: finished.length })}
              <Icon
                name="chevron-down"
                class="h-3.5 w-3.5 transition-transform duration-200 {showFinished
                  ? 'rotate-180'
                  : ''}" />
            </button>
            <span class="bg-border h-px flex-1" aria-hidden="true"></span>
          </div>
          {#if showFinished}
            <div transition:slide={{ duration: ms(260), easing: cubicOut }}>
              {@render section(
                m.media_sagas_finished(),
                finishedHint,
                finished,
                "finished",
              )}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<svelte:window onkeydown={onKeydown} />

{#if filtersOpen}
  <LibraryFiltersPanel
    onclose={() => (filtersOpen = false)}
    {total}
    extraLabel={typeOptions.length > 0 ? m.common_type() : undefined}
    extraOptions={typeOptions}
    extra={types}
    onExtra={(values) => (types = values)}
    favorites={false}
    sorts={SORTS}
    bind:sort
    bind:reversed
    onReset={resetFilters} />
{/if}

{#snippet pageActions()}
  <div class="flex items-center gap-3">
    {@render modeSwitch()}
    {#if !layout.compact}
      {@render searchField()}
    {/if}
  </div>
{/snippet}

{#snippet searchField()}
  <LibrarySearchField
    bind:input={searchInput}
    value={query}
    oninput={setQuery} />
{/snippet}

<style>
  /* Fanned out on hover, like a hand of cards spread on the table. */
  .saga-card {
    transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  :global(.group:focus-within) .saga-card {
    transform: translateX(var(--spread)) rotate(var(--tilt));
  }

  @media (hover: hover) {
    :global(.group:hover) .saga-card {
      transform: translateX(var(--spread)) rotate(var(--tilt));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .saga-card {
      transition: none;
    }
  }
</style>
