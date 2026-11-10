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
  import Combobox from "#lib/components/Combobox.svelte";
  import { formatDate, joinMeta } from "#lib/format.js";
  import { pendingPortrait } from "#lib/shared-poster.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import type {
    CreatorCreditKind,
    CreatorGroupKey,
    CreatorSource,
    CreatorWorkDto,
  } from "@loomkeep/shared";
  import {
    lifeYears,
    mixesTypes,
    splitCredits,
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

  const MENTION_LABELS: Partial<Record<CreatorCreditKind, () => string>> = {
    TV_APPEARANCE: m.creator_kind_tv_appearance,
    DOCUMENTARY: m.creator_kind_documentary,
    CAMEO: m.creator_kind_cameo,
    THANKS: m.creator_kind_thanks,
  };
  const MENTIONS_SHOWN = 6;
  const ORDER_OPTIONS = [
    { label: m.creator_order_newest(), value: "newest" },
    { label: m.creator_order_oldest(), value: "oldest" },
  ];
  const reduced = prefersReducedMotion();

  const source = $derived((page.params.source ?? "") as CreatorSource);
  const id = $derived(page.params.id ?? "");

  const personQuery = createApiQuery(() => ({
    key: keys.creators.person(source, id),
    fetch: () => getPersonPage(source, id),
    enabled: !!source && !!id,
  }));
  const person = $derived(personQuery.data);
  const credits = $derived(
    person ? splitCredits(person.groups) : { tabs: [], mentions: [] },
  );

  let chosenGroup = $state<CreatorGroupKey | null>(null);
  let type = $state<WorkTypeFilter>("ALL");
  let inLibrary = $state(false);
  let order = $state<WorkOrder>("newest");
  let mentionKind = $state<CreatorCreditKind | null>(null);
  let allMentions = $state(false);

  const group = $derived(
    credits.tabs.find((g) => g.key === chosenGroup) ?? credits.tabs[0] ?? null,
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
  const features = $derived(works.filter((w) => w.kind !== "SHORT"));
  const shorts = $derived(works.filter((w) => w.kind === "SHORT"));

  const mentionKinds = $derived([
    ...new Set(credits.mentions.map((w) => w.kind)),
  ]);
  const mentions = $derived(
    credits.mentions.filter((w) => !mentionKind || w.kind === mentionKind),
  );
  const shownMentions = $derived(
    allMentions ? mentions : mentions.slice(0, MENTIONS_SHOWN),
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
      group?.key === "ACTING" ? work.character : work.jobs.join(", ");
    return joinMeta(role, episodes(work));
  }
</script>

{#snippet workGrid(list: CreatorWorkDto[])}
  <PosterGrid size="small">
    {#each list as work (`${work.type}:${work.sourceId}`)}
      <div
        class="min-w-0"
        animate:flip={{ duration: reduced ? 0 : 250 }}
        in:fade|global={{ duration: reduced ? 0 : 150 }}
        out:fade={{ duration: reduced ? 0 : 100 }}>
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
      </div>
    {/each}
  </PosterGrid>
{/snippet}

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
          tabs={credits.tabs.map((g) => ({
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
            <div class="ml-auto">
              <Combobox
                label={m.common_sort()}
                options={ORDER_OPTIONS}
                values={[order]}
                onChange={(v) => (order = (v[0] as WorkOrder) ?? order)} />
            </div>
          </div>

          {#if features.length > 0}
            <div class="mt-5">{@render workGrid(features)}</div>
          {/if}
          {#if shorts.length > 0}
            <h2 class="font-display mt-8 mb-3 text-lg font-bold">
              {m.creator_shorts()}
              <span class="timecode text-dim ml-1 text-xs"
                >{shorts.length}</span>
            </h2>
            {@render workGrid(shorts)}
          {/if}
          {#if works.length === 0}
            <EmptyState padding="py-12">
              <p>{m.creator_no_match()}</p>
            </EmptyState>
          {/if}
        </TabPanels>
      </div>
    {:else if credits.mentions.length === 0}
      <EmptyState padding="py-12">
        <p>{m.creator_no_works()}</p>
      </EmptyState>
    {/if}

    {#if credits.mentions.length > 0}
      <section class="border-border mt-10 border-t pt-6">
        <div
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 class="font-display text-xl font-bold">
            {m.creator_mentions()}
            <span class="timecode text-dim ml-1 text-xs"
              >{credits.mentions.length}</span>
          </h2>
          {#if mentionKinds.length > 1}
            <div
              class="flex flex-wrap gap-2"
              role="group"
              aria-label={m.creator_mention_kind()}>
              <button
                type="button"
                class="chip {mentionKind === null ? 'chip-on' : ''}"
                aria-pressed={mentionKind === null}
                onclick={() => (mentionKind = null)}>
                {m.common_all()}
              </button>
              {#each mentionKinds as kind (kind)}
                <button
                  type="button"
                  class="chip {mentionKind === kind ? 'chip-on' : ''}"
                  aria-pressed={mentionKind === kind}
                  onclick={() => (mentionKind = kind)}>
                  {MENTION_LABELS[kind]?.()}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <ul class="mt-3 grid gap-x-8 md:grid-cols-2">
          {#each shownMentions as work (`${work.type}:${work.sourceId}`)}
            <li class="border-border border-b">
              <a
                href={`/app/media/${work.type.toLowerCase()}/${work.sourceId}`}
                class="hover:text-accent grid grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-2.5 py-2 text-sm transition-colors">
                <span class="timecode text-dim text-xs"
                  >{work.year ?? "—"}</span>
                <span class="truncate font-semibold">
                  {work.title}
                  {#if episodes(work)}
                    <span class="text-dim text-xs font-normal"
                      >· {episodes(work)}</span>
                  {/if}
                </span>
                <span
                  class="border-border text-dim rounded-full border px-2 text-[0.7rem] font-semibold whitespace-nowrap">
                  {MENTION_LABELS[work.kind]?.()}
                </span>
              </a>
            </li>
          {/each}
        </ul>
        {#if mentions.length > MENTIONS_SHOWN}
          <button
            type="button"
            class="text-accent mt-2 text-sm font-bold"
            aria-expanded={allMentions}
            onclick={() => (allMentions = !allMentions)}>
            {allMentions
              ? m.common_see_less()
              : m.creator_mentions_all({ count: mentions.length })}
          </button>
        {/if}
      </section>
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
