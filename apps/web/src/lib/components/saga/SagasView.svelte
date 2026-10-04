<script lang="ts" module>
  import type { LibrarySagaSort } from "@loomkeep/shared";

  export interface SagaListFilters {
    query: string;
    types: string[];
    sort: LibrarySagaSort;
    order: "asc" | "desc";
  }
</script>

<script lang="ts">
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import TrackingStatusBadge from "$lib/components/TrackingStatusBadge.svelte";
  import { debounce } from "$lib/debounce";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    LibrarySagasView,
    LibrarySagaView,
    SagaMemberView,
  } from "$lib/saga";
  import type { IconName } from "$lib/types/icon-name";
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
    typeOptions?: { label: string; value: string }[];
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
  const SORTS: { label: string; value: LibrarySagaSort }[] = [
    { label: m.media_sagas_sort_recent(), value: "recent" },
    { label: m.common_title(), value: "title" },
    { label: m.common_progress(), value: "progress" },
  ];

  let query = $state("");
  let appliedQuery = $state("");
  let types = $state<string[]>([]);
  let sort = $state<LibrarySagaSort>("recent");
  let reversed = $state(false);
  const applyQuery = debounce(() => (appliedQuery = query), 250);

  const filters = $derived<SagaListFilters>({
    query: appliedQuery.trim(),
    types,
    sort,
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
          style:left="{i * 0.75}rem"
          style:z-index={10 - i}
          style:--spread="{i * 0.3}rem"
          style:--tilt="{i * 2.5}deg">
          <Poster
            src={member.posterUrl}
            title={member.title}
            alt=""
            caption={false} />
        </div>
      {/each}
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <p class="flex items-baseline gap-2">
        <!-- Stretched over the row: the row leads to the next work. -->
        <a
          href={focus.href}
          class="font-display focus-visible:after:outline-accent truncate text-lg font-bold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2">
          {saga.title}
        </a>
        {#if saga.kind}
          <span class="timecode shrink-0 text-[0.65rem] uppercase">
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
        <h2 class="font-display text-xl font-bold">{heading}</h2>
        <span class="timecode text-xs">{hint}</span>
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
    {icon}
    {title}
    subtitle={sagasQuery.data
      ? total === 1
        ? m.media_sagas_count_one({ count: total })
        : m.media_sagas_count_many({ count: total })
      : undefined}
    actions={modeSwitch}
    class="mb-6" />

  <div class="relative mb-4">
    <span
      class="text-dim pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <Icon name="search" class="h-5 w-5" />
    </span>
    <input
      type="search"
      name="query"
      aria-label={m.library_filter_placeholder()}
      enterkeyhint="search"
      placeholder={m.library_filter_placeholder()}
      value={query}
      oninput={(e) => {
        query = e.currentTarget.value;
        applyQuery.call();
      }}
      class="input pl-10" />
  </div>

  <div
    class="mb-7 flex flex-wrap items-center gap-2 {typeOptions.length > 0
      ? 'justify-between'
      : 'justify-end'}">
    {#if typeOptions.length > 0}
      <Combobox
        label={m.common_type()}
        multiselect
        options={typeOptions}
        values={types}
        onChange={(v) => (types = v)} />
    {/if}
    <div class="flex items-center gap-2">
      <Combobox
        label={m.common_sort()}
        options={SORTS}
        values={[sort]}
        onChange={(v) => (sort = (v[0] as LibrarySagaSort) ?? sort)} />
      <button
        type="button"
        class="chip px-2.5 font-mono"
        title={reversed ? m.common_sort_reversed() : m.common_sort_default()}
        aria-label={m.common_reverse_sort()}
        onclick={() => (reversed = !reversed)}>
        {reversed ? "↑" : "↓"}
      </button>
    </div>
  </div>

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
        <EmptyState>
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

<style>
  /* Fanned out on hover, like a hand of cards spread on the table. */
  .saga-card {
    transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  :global(.group:hover) .saga-card,
  :global(.group:focus-within) .saga-card {
    transform: translateX(var(--spread)) rotate(var(--tilt));
  }

  @media (prefers-reduced-motion: reduce) {
    .saga-card {
      transition: none;
    }
  }
</style>
