<script lang="ts">
  // A production company's or a network's page: who it is, then its films
  // and series 20 at a time, each with the viewer's status. No "in my
  // library" filter: the catalogue comes from TMDB a page at a time, and the
  // library stores no studio to filter on.
  import { getStudioPage, getStudioWorks } from "#lib/api/client.js";
  import { createApiInfiniteQuery } from "#lib/api/infinite-query.svelte.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { goBack } from "#lib/back-nav.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import ClampedText from "#lib/components/ClampedText.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import DetailsCard from "#lib/components/DetailsCard.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import PosterCard from "#lib/components/PosterCard.svelte";
  import PosterGrid from "#lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "#lib/components/PosterGridSkeleton.svelte";
  import ProviderMark from "#lib/components/ProviderMark.svelte";
  import SeeMore from "#lib/components/SeeMore.svelte";
  import TabPanels from "#lib/components/TabPanels.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import { creatorPeek } from "#lib/creator-peek/peek.svelte.js";
  import { studioHref, workHref } from "#lib/creator-href.js";
  import { formatRegion, joinMeta } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    CreatorSource,
    CreatorWorkDto,
    EntryStatus,
    PagedResult,
    StudioKind,
    StudioWorkOrder,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";

  let {
    kind,
    source,
    id,
  }: { kind: StudioKind; source: CreatorSource; id: string } = $props();

  type WorkType = "MOVIE" | "SERIES";
  const ORDER_OPTIONS = [
    { label: m.creator_order_known(), value: "known" },
    { label: m.creator_order_newest(), value: "newest" },
    { label: m.creator_order_oldest(), value: "oldest" },
  ];
  const reduced = prefersReducedMotion();

  const studioQuery = createApiQuery(() => ({
    key: keys.creators.studio(kind, source, id),
    fetch: () => getStudioPage(kind, source, id),
    enabled: !!source && !!id,
  }));
  const studio = $derived(studioQuery.data);

  let chosenType = $state<WorkType | null>(null);
  let order = $state<StudioWorkOrder>("known");

  const types = $derived(
    studio
      ? (
          [
            ["MOVIE", studio.movieCount],
            ["SERIES", studio.seriesCount],
          ] as const
        ).filter(([, count]) => count > 0)
      : [],
  );
  const type = $derived<WorkType>(
    chosenType ?? (types[0]?.[0] as WorkType | undefined) ?? "SERIES",
  );

  const worksQuery = createApiInfiniteQuery(() => ({
    key: keys.creators.studioWorks(kind, source, id, type, order),
    fetch: (page: number) =>
      getStudioWorks(kind, source, id, { type, order, page }),
    getPageItems: (page: PagedResult<CreatorWorkDto>) => page.items,
    initialPageParam: 1,
    getNextPageParam: (
      last: PagedResult<CreatorWorkDto>,
      all: PagedResult<CreatorWorkDto>[],
    ) => (last.hasMore ? all.length + 1 : undefined),
    enabled: !!studio && types.length > 0,
    keepPreviousData: true,
  }));
  const works = $derived(worksQuery.data);
  const total = $derived(worksQuery.pages[0]?.total ?? 0);

  const typeLabel = (t: WorkType) =>
    t === "MOVIE" ? m.media_movies() : m.media_series_plural();
  const parentHref = $derived(
    studio?.parent ? studioHref("COMPANY", studio.parent) : null,
  );
</script>

{#snippet grid()}
  <div class="mt-4 flex flex-wrap items-center gap-2">
    <Combobox
      label={m.common_sort()}
      options={ORDER_OPTIONS}
      values={[order]}
      onChange={(v) => (order = (v[0] as StudioWorkOrder) ?? order)} />
  </div>
  {#if worksQuery.loading}
    <div class="mt-5"><PosterGridSkeleton size="small" count={12} /></div>
  {:else if worksQuery.error}
    <div class="mt-5"><Banner variant="error">{worksQuery.error}</Banner></div>
  {:else if works.length === 0}
    <EmptyState padding="py-12"><p>{m.creator_no_works()}</p></EmptyState>
  {:else}
    <div class="mt-5">
      <PosterGrid size="small">
        {#each works as work (`${work.type}:${work.sourceId}`)}
          <div
            class="min-w-0"
            animate:flip={{ duration: reduced ? 0 : 250 }}
            in:fade|global={{ duration: reduced ? 0 : 150 }}
            out:fade={{ duration: reduced ? 0 : 100 }}>
            <PosterCard
              href={workHref(work)}
              src={work.posterUrl}
              title={work.title}>
              {#snippet badge()}
                {#if work.status}
                  <TrackingStatusBadge
                    domain="MEDIA"
                    status={work.status as EntryStatus}
                    onImage
                    compact />
                {:else if work.upcoming}
                  <span
                    class="rounded-full bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                    {m.media_saga_upcoming()}
                  </span>
                {/if}
              {/snippet}
              {#snippet meta()}
                <span class="text-dim text-micro">{work.year ?? "—"}</span>
              {/snippet}
            </PosterCard>
          </div>
        {/each}
      </PosterGrid>
    </div>
    {#if worksQuery.hasNextPage}
      <SeeMore
        expanded={false}
        onclick={() => worksQuery.fetchNextPage()}
        more={m.creator_load_more({ shown: works.length, total })}
        ruled
        class="mt-5" />
    {/if}
  {/if}
{/snippet}

{#if studioQuery.error}
  <div class="mx-auto max-w-5xl px-5 py-6 md:px-8">
    <Banner variant="error">{studioQuery.error}</Banner>
    <a href="/app/media" onclick={goBack} class="btn btn-ghost mt-4">
      ← {m.common_back()}
    </a>
  </div>
{:else if studio}
  <div class="mx-auto max-w-5xl px-5 pt-2 pb-10 md:px-8 md:pt-8">
    <PageHeader title={studio.name} back="/app/media" backInHistory />

    <div
      class="md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-x-10">
      <div
        class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-x-6">
        <!-- Logos are drawn for a light background, dark themes included. -->
        <div
          class="grid aspect-square place-items-center overflow-hidden rounded-xl bg-white p-3">
          {#if studio.logoUrl}
            <img
              src={studio.logoUrl}
              alt={studio.name}
              class="max-h-full max-w-full object-contain" />
          {:else}
            <span
              class="font-display text-center text-lg font-extrabold text-black">
              {studio.name}
            </span>
          {/if}
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <p class="text-dim text-sm">
            {kind === "NETWORK"
              ? m.creator_studio_network()
              : m.creator_studio_company()}
          </p>
          {#if studio.headquarters || studio.country}
            <p class="timecode text-xs">
              {joinMeta(
                studio.headquarters,
                studio.country ? formatRegion(studio.country) : null,
              )}
            </p>
          {/if}
          {#if studio.homepage}
            <div class="mt-1 flex flex-wrap gap-2">
              <a
                href={studio.homepage}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors">
                {m.media_official_site()}
              </a>
            </div>
          {/if}
          {#if studio.description}
            <ClampedText
              text={studio.description}
              lines={4}
              class="text-dim mt-2 text-sm whitespace-pre-line" />
          {/if}
        </div>
      </div>

      {#if studio.headquarters || studio.country || studio.parent}
        <aside class="mt-6 md:mt-0">
          <DetailsCard>
            {#if studio.headquarters}
              <div>
                <dt class="timecode text-xs">{m.creator_headquarters()}</dt>
                <dd class="mt-0.5 text-sm">{studio.headquarters}</dd>
              </div>
            {/if}
            {#if studio.country}
              <div>
                <dt class="timecode text-xs">{m.creator_country()}</dt>
                <dd class="mt-0.5 text-sm">{formatRegion(studio.country)}</dd>
              </div>
            {/if}
            {#if studio.parent}
              <div>
                <dt class="timecode text-xs">{m.creator_parent()}</dt>
                <dd class="mt-0.5 text-sm font-semibold">
                  {#if parentHref}
                    <a
                      href={parentHref}
                      use:creatorPeek={{
                        ref: studio.parent,
                        studio: "COMPANY",
                      }}
                      class="decoration-dim/50 hover:text-accent underline underline-offset-4 transition-colors hover:decoration-current">
                      {studio.parent.name}
                    </a>
                  {:else}
                    {studio.parent.name}
                  {/if}
                </dd>
              </div>
            {/if}
          </DetailsCard>
        </aside>
      {/if}
    </div>

    <div class="mt-8">
      {#if types.length > 1}
        <Tabs
          tabs={types.map(([t, count]) => ({
            value: t,
            label: `${typeLabel(t)} · ${count}`,
          }))}
          current={type}
          onSelect={(t) => (chosenType = t as WorkType)}
          label={m.creator_work_type()}
          idPrefix="studio-type" />
        <TabPanels current={type} idPrefix="studio-type">
          {@render grid()}
        </TabPanels>
      {:else if types.length === 1}
        <p class="timecode text-dim text-xs">
          {type === "MOVIE"
            ? m.creator_count_movies({ count: studio.movieCount })
            : m.creator_count_series({ count: studio.seriesCount })}
        </p>
        {@render grid()}
      {:else}
        <EmptyState padding="py-12"><p>{m.creator_no_works()}</p></EmptyState>
      {/if}
    </div>

    <p class="text-dim text-micro mt-8 flex items-center gap-1.5">
      <ProviderMark
        brand="tmdb"
        decorative
        class="h-3 w-3 shrink-0 opacity-70" />
      {m.datasource_tmdb_notice()}
    </p>
  </div>
{:else}
  <div
    class="mx-auto max-w-5xl px-5 pt-2 pb-10 md:px-8 md:pt-8"
    aria-hidden="true">
    <div class="flex min-h-14 items-center">
      <div class="skeleton h-7 w-2/3 max-w-xs rounded"></div>
    </div>
    <div
      class="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-x-6">
      <div class="skeleton aspect-square rounded-xl"></div>
      <div class="flex flex-col gap-2 pt-1">
        <div class="skeleton h-3 w-1/2 max-w-40 rounded"></div>
        <div class="skeleton h-3 w-1/3 max-w-32 rounded"></div>
      </div>
    </div>
    <div class="mt-10">
      <PosterGridSkeleton size="small" count={12} />
    </div>
  </div>
{/if}
