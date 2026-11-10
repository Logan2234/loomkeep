<script lang="ts">
  import { page } from "$app/state";
  import { getPersonPage } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { goBack } from "#lib/back-nav.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import ClampedText from "#lib/components/ClampedText.svelte";
  import DetailsCard from "#lib/components/DetailsCard.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import PosterCard from "#lib/components/PosterCard.svelte";
  import PosterGrid from "#lib/components/PosterGrid.svelte";
  import PosterGridSkeleton from "#lib/components/PosterGridSkeleton.svelte";
  import ProviderMark from "#lib/components/ProviderMark.svelte";
  import SegmentedControl from "#lib/components/SegmentedControl.svelte";
  import TabPanels from "#lib/components/TabPanels.svelte";
  import Tabs from "#lib/components/Tabs.svelte";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import { formatDate, joinMeta } from "#lib/format.js";
  import { pendingPortrait } from "#lib/shared-poster.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    CreatorGroupKey,
    CreatorSource,
    CreatorWorkDto,
  } from "@loomkeep/shared";
  import {
    isSelfAppearance,
    lifeYears,
    mixesTypes,
    visibleWorks,
    type WorkOrder,
    type WorkTypeFilter,
  } from "./person-page";

  const GROUP_LABELS: Record<CreatorGroupKey, () => string> = {
    DIRECTING: m.creator_group_directing,
    WRITING: m.creator_group_writing,
    PRODUCTION: m.creator_group_production,
    SOUND: m.creator_group_sound,
    CAMERA: m.creator_group_camera,
    EDITING: m.creator_group_editing,
    ART: m.creator_group_art,
    CREW: m.creator_group_crew,
    ACTING: m.creator_group_acting,
  };

  const source = $derived((page.params.source ?? "") as CreatorSource);
  const id = $derived(page.params.id ?? "");

  const personQuery = createApiQuery(() => ({
    key: keys.creators.person(source, id),
    fetch: () => getPersonPage(source, id),
    enabled: !!source && !!id,
  }));
  const person = $derived(personQuery.data);

  let chosenGroup = $state<CreatorGroupKey | null>(null);
  let type = $state<WorkTypeFilter>("ALL");
  let inLibrary = $state(false);
  let order = $state<WorkOrder>("newest");

  const group = $derived(
    person?.groups.find((g) => g.key === chosenGroup) ??
      person?.groups[0] ??
      null,
  );
  const typesMixed = $derived(!!group && mixesTypes(group.works));
  const works = $derived(
    group
      ? visibleWorks(group.works, {
          type: typesMixed ? type : "ALL",
          inLibrary,
          order,
        })
      : [],
  );

  const life = $derived(
    person ? lifeYears(person.birthday, person.deathday) : null,
  );
  const hasFacts = $derived(
    !!person &&
      (!!person.birthday || !!person.deathday || person.alsoKnownAs.length > 0),
  );

  const episodes = (work: CreatorWorkDto) =>
    work.type === "SERIES" && work.episodeCount
      ? `${work.episodeCount} ${m.media_episode_short()}`
      : null;

  function credit(work: CreatorWorkDto): string {
    const role =
      group?.key === "ACTING"
        ? isSelfAppearance(work.character)
          ? m.creator_as_self()
          : work.character
        : work.jobs.join(", ");
    return joinMeta(role, episodes(work));
  }
</script>

{#snippet bio()}
  <ClampedText
    text={person?.description ?? ""}
    lines={4}
    class="text-dim text-sm whitespace-pre-line" />
{/snippet}

{#if personQuery.error}
  <div class="mx-auto max-w-5xl px-5 py-6 md:px-8">
    <Banner variant="error">{personQuery.error}</Banner>
    <a href="/app/media" onclick={goBack} class="btn btn-ghost mt-4"
      >← {m.common_back()}</a>
  </div>
{:else if person}
  <div class="mx-auto max-w-5xl px-5 pt-2 pb-10 md:px-8 md:pt-8">
    <PageHeader title={person.name} back="/app/media" backInHistory />

    <div
      class="md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-x-10">
      <div
        class="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-x-6">
        <div class="overflow-hidden rounded-lg" data-detail-portrait>
          <Poster src={person.photoUrl} title={person.name} alt={person.name} />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          {#if person.knownFor}
            <p class="text-dim text-sm">
              {m.creator_known_for({ group: GROUP_LABELS[person.knownFor]() })}
            </p>
          {/if}
          {#if life || person.placeOfBirth}
            <p class="timecode text-xs">
              {joinMeta(life, person.placeOfBirth)}
            </p>
          {/if}
          <div class="mt-1 flex flex-wrap gap-2">
            {#if person.homepage}
              <a
                href={person.homepage}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >{m.media_official_site()}</a>
            {/if}
            {#if person.imdbId}
              <a
                href={`https://www.imdb.com/name/${person.imdbId}/`}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >IMDb ↗</a>
            {/if}
            {#if person.wikidataId}
              <a
                href={`https://www.wikidata.org/wiki/${person.wikidataId}`}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                >Wikidata ↗</a>
            {/if}
          </div>
          {#if person.description}
            <div class="mt-2 hidden md:block">{@render bio()}</div>
          {/if}
        </div>
      </div>
      <!-- A phone has no room beside the portrait: the biography goes under it. -->
      {#if person.description}
        <div class="mt-4 md:hidden">{@render bio()}</div>
      {/if}

      {#if hasFacts}
        <aside class="mt-6 md:mt-0">
          <DetailsCard>
            {#if person.birthday}
              <div>
                <dt class="timecode text-xs">{m.creator_born()}</dt>
                <dd class="mt-0.5 text-sm">{formatDate(person.birthday)}</dd>
              </div>
            {/if}
            {#if person.deathday}
              <div>
                <dt class="timecode text-xs">{m.creator_died()}</dt>
                <dd class="mt-0.5 text-sm">{formatDate(person.deathday)}</dd>
              </div>
            {/if}
            {#if person.alsoKnownAs.length > 0}
              <div>
                <dt class="timecode text-xs">{m.creator_also_known_as()}</dt>
                <dd class="mt-0.5 text-sm wrap-anywhere">
                  {person.alsoKnownAs.slice(0, 3).join(" · ")}
                </dd>
              </div>
            {/if}
          </DetailsCard>
        </aside>
      {/if}
    </div>

    {#if group}
      <div class="mt-8">
        <Tabs
          tabs={person.groups.map((g) => ({
            value: g.key,
            label: `${GROUP_LABELS[g.key]()} · ${g.works.length}`,
          }))}
          current={group.key}
          onSelect={(key) => (chosenGroup = key)}
          label={m.creator_roles()}
          idPrefix="creator-group" />
        <TabPanels current={group.key} idPrefix="creator-group">
          <div class="mt-4 flex flex-wrap items-center gap-2">
            {#if typesMixed}
              <SegmentedControl
                options={[
                  { value: "ALL", label: m.common_all() },
                  { value: "MOVIE", label: m.media_movies() },
                  { value: "SERIES", label: m.media_series_plural() },
                ]}
                value={type}
                onChange={(value) => (type = value)}
                label={m.creator_work_type()} />
            {/if}
            <button
              type="button"
              class="chip {inLibrary ? 'chip-on' : ''}"
              aria-pressed={inLibrary}
              onclick={() => (inLibrary = !inLibrary)}>
              {m.creator_in_library()}
            </button>
            <label class="ml-auto">
              <span class="sr-only">{m.common_sort()}</span>
              <select class="input w-auto py-1.5 text-sm" bind:value={order}>
                <option value="newest">{m.creator_order_newest()}</option>
                <option value="oldest">{m.creator_order_oldest()}</option>
              </select>
            </label>
          </div>

          {#if works.length > 0}
            <div class="mt-5">
              <PosterGrid size="small">
                {#each works as work (`${work.type}:${work.sourceId}`)}
                  <PosterCard
                    href={`/app/media/${work.type.toLowerCase()}/${work.sourceId}`}
                    src={work.posterUrl}
                    title={work.title}>
                    {#snippet badge()}
                      {#if work.status}
                        <TrackingStatusBadge
                          domain="MEDIA"
                          status={work.status}
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
                      <span class="text-dim text-micro">
                        {joinMeta(work.year, credit(work))}
                      </span>
                    {/snippet}
                  </PosterCard>
                {/each}
              </PosterGrid>
            </div>
          {:else}
            <EmptyState padding="py-12">
              <p>{m.creator_no_match()}</p>
            </EmptyState>
          {/if}
        </TabPanels>
      </div>
    {:else}
      <EmptyState padding="py-12">
        <p>{m.creator_no_works()}</p>
      </EmptyState>
    {/if}

    {#if source === "tmdb"}
      <p class="text-dim text-micro mt-8 flex items-center gap-1.5">
        <ProviderMark
          brand="tmdb"
          decorative
          class="h-3 w-3 shrink-0 opacity-70" />
        {m.datasource_tmdb_notice()}
      </p>
    {/if}
  </div>
{:else}
  <!-- Laid out like the loaded header, so the portrait carried over from the
       cast dialog lands where the real one will be. -->
  <div
    class="mx-auto max-w-5xl px-5 pt-2 pb-10 md:px-8 md:pt-8"
    aria-hidden="true">
    <div class="flex min-h-14 items-center">
      <div class="skeleton h-7 w-2/3 max-w-xs rounded"></div>
    </div>
    <div
      class="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-x-6">
      <div
        class="skeleton aspect-2/3 overflow-hidden rounded-lg"
        data-detail-portrait>
        {#if pendingPortrait.src}
          <img
            src={pendingPortrait.src}
            alt=""
            class="h-full w-full object-cover" />
        {/if}
      </div>
      <div class="flex flex-col gap-2 pt-1">
        <div class="skeleton h-3 w-1/2 max-w-40 rounded"></div>
        <div class="skeleton h-3 w-1/3 max-w-32 rounded"></div>
        <div class="skeleton mt-3 h-3 w-full max-w-lg rounded"></div>
        <div class="skeleton h-3 w-5/6 max-w-md rounded"></div>
      </div>
    </div>
    <div class="mt-10">
      <PosterGridSkeleton size="small" count={12} />
    </div>
  </div>
{/if}
