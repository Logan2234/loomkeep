<script lang="ts">
  import { listLibrarySagas, upsertLibraryEntry } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
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
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { sagaMemberHref, sagaMemberMeta, sagaSegmentClass } from "$lib/saga";
  import type {
    LibrarySagaDto,
    LibrarySagaSort,
    MediaType,
    SagaMemberDto,
  } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, scale } from "svelte/transition";

  let { modeSwitch }: { modeSwitch: Snippet } = $props();

  const reduced = prefersReducedMotion();
  const ms = (duration: number) => (reduced ? 0 : duration);

  // Only the filters a saga can answer: a saga has no status or favourite of
  // its own, so those stay with the works view.
  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: m.media_movies(), value: "MOVIE" },
    { label: m.media_anime(), value: "ANIME" },
  ];
  const SORTS: { label: string; value: LibrarySagaSort }[] = [
    { label: m.media_sagas_sort_recent(), value: "recent" },
    { label: m.common_title(), value: "title" },
    { label: m.common_progress(), value: "progress" },
  ];

  let query = $state("");
  let appliedQuery = $state("");
  let types = $state<MediaType[]>([]);
  let sort = $state<LibrarySagaSort>("recent");
  let reversed = $state(false);
  const applyQuery = debounce(() => (appliedQuery = query), 250);

  const filters = $derived({
    query: appliedQuery.trim(),
    types,
    sort,
    // Titles read A to Z by default, the rest most-first.
    order: (sort === "title") !== reversed ? "asc" : "desc",
  } as const);
  const filtered = $derived(filters.query !== "" || types.length > 0);

  const sagasQuery = createApiQuery(() => ({
    key: keys.library.sagas(filters),
    fetch: () => listLibrarySagas(filters),
  }));
  const inProgress = $derived(sagasQuery.data?.inProgress ?? []);
  const waiting = $derived(sagasQuery.data?.waiting ?? []);
  const total = $derived(inProgress.length + waiting.length);

  const addMut = createApiMutation(() => ({
    mutate: (x: SagaMemberDto) =>
      upsertLibraryEntry({
        source: x.source,
        sourceId: x.sourceId,
        type: x.type,
        status: "PLANNED",
      }),
    invalidates: [["library", "sagas"]],
    errorToast: true,
  }));

  // The posters up to the next work, last four: the run so far, ending on
  // what comes next.
  const stackOf = (saga: LibrarySagaDto) => {
    const until = saga.members.indexOf(
      saga.members.find((x) => x.sourceId === saga.next.sourceId)!,
    );
    return saga.members.slice(Math.max(0, until - 3), until + 1);
  };
  const isSeen = (x: SagaMemberDto) =>
    x.status === "COMPLETED" || x.status === "UP_TO_DATE";
</script>

{#snippet sagaRow(saga: LibrarySagaDto, waitingOn: boolean)}
  <div
    role="listitem"
    class="group hover:bg-surface-2/60 relative grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-4 transition-colors sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
    <div class="relative h-[4.25rem]" aria-hidden="true">
      {#each stackOf(saga) as member, i (member.sourceId)}
        <div
          class="saga-card absolute top-0 w-11 shadow-lg {isSeen(member)
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
          href={sagaMemberHref(saga.next)}
          class="font-display focus-visible:after:outline-accent truncate text-lg font-bold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2">
          {saga.title}
        </a>
        <span class="timecode shrink-0 text-[0.65rem] uppercase">
          {saga.next.type === "ANIME" ? m.media_anime() : m.media_movies()}
        </span>
      </p>
      <div class="flex gap-0.5" aria-hidden="true">
        {#each saga.members as member (member.sourceId)}
          <span
            class="h-2 flex-1 rounded-sm transition-colors duration-500 {sagaSegmentClass(
              member,
            )}"></span>
        {/each}
      </div>
      <p class="text-dim truncate text-sm">
        {waitingOn
          ? m.media_sagas_next_release({ title: saga.next.title })
          : m.media_sagas_next({ title: saga.next.title })}
        <span class="timecode text-xs">· {sagaMemberMeta(saga.next)}</span>
      </p>
    </div>

    <div
      class="relative z-10 col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
      <span class="font-mono text-xl font-bold tabular-nums">
        {saga.seen}<span class="text-dim">/{saga.released}</span>
      </span>
      {#key saga.next.status}
        <div in:scale={{ start: 0.7, duration: ms(220), easing: cubicOut }}>
          {#if saga.next.status}
            <TrackingStatusBadge domain="MEDIA" status={saga.next.status} />
          {:else if waitingOn}
            <span
              class="border-border text-dim inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-bold">
              <Icon name="calendar" class="h-3.5 w-3.5" />
              {m.media_saga_upcoming()}
            </span>
          {:else}
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              aria-label={m.media_saga_add_label({ title: saga.next.title })}
              disabled={addMut.loading}
              onclick={() => addMut.mutate(saga.next)}>
              <Icon name="plus" class="h-3.5 w-3.5" />
              {m.media_status_planned()}
            </button>
          {/if}
        </div>
      {/key}
    </div>
  </div>
{/snippet}

{#snippet section(
  title: string,
  hint: string,
  sagas: LibrarySagaDto[],
  waitingOn: boolean,
)}
  {#if sagas.length > 0}
    <section
      class="flex flex-col gap-3"
      in:fly={{ y: 10, duration: ms(260), easing: cubicOut }}>
      <div class="flex items-baseline gap-3">
        <h2 class="font-display text-xl font-bold">{title}</h2>
        <span class="timecode text-xs">{hint}</span>
      </div>
      <div
        role="list"
        aria-label={title}
        class="card divide-border divide-y {waitingOn ? 'opacity-90' : ''}">
        {#each sagas as saga (saga.key)}
          {@render sagaRow(saga, waitingOn)}
        {/each}
      </div>
    </section>
  {/if}
{/snippet}

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="tv"
    title={m.common_Media()}
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

  <div class="mb-7 flex flex-wrap items-center justify-between gap-2">
    <Combobox
      label={m.common_type()}
      multiselect
      options={TYPE_OPTIONS}
      values={types}
      onChange={(v) => (types = v as MediaType[])} />
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
  {:else if total === 0}
    <EmptyState>
      {filtered ? m.media_sagas_empty_filtered() : m.media_sagas_empty()}
    </EmptyState>
  {:else}
    <div class="flex flex-col gap-9">
      {@render section(
        m.media_sagas_in_progress(),
        m.media_sagas_in_progress_hint(),
        inProgress,
        false,
      )}
      {@render section(
        m.media_sagas_waiting(),
        m.media_sagas_waiting_hint(),
        waiting,
        true,
      )}
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
