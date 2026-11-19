<script lang="ts">
  import { getPremieres, upsertLibraryEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import Carousel from "#lib/components/Carousel.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { formatDate, formatRegion } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fetchTrackedMedia, trackKey } from "#lib/tracked-media.js";
  import {
    PREMIERE_NETWORKS,
    premiereNetworksFor,
    type PremiereDto,
  } from "@loomkeep/shared";
  import {
    groupPremieres,
    pickHeadliner,
    premiereDay,
    premiereOffset,
    type PremiereRail,
  } from "../premiere-groups";

  const premieresQuery = createApiQuery(() => ({
    key: keys.calendar.premieres(),
    fetch: getPremieres,
  }));
  const premieres = $derived(premieresQuery.data ?? []);

  const trackedQuery = createApiQuery(() => ({
    key: keys.library.tracked(),
    fetch: fetchTrackedMedia,
  }));
  const isTracked = (p: PremiereDto) =>
    trackedQuery.data?.has(trackKey("SERIES", p.sourceId)) ?? false;

  const addMut = createApiMutation(() => ({
    mutate: (p: PremiereDto) =>
      upsertLibraryEntry({
        source: "TMDB",
        sourceId: p.sourceId,
        type: "SERIES",
        status: "PLANNED",
      }),
    invalidates: [keys.library.tracked(), keys.calendar.upcoming()],
    successToast: (_, p) =>
      m.calendar_premieres_added_toast({ title: p.title }),
    errorToast: true,
  }));

  // "My services" only when the user's services map to followed networks.
  const myNetworks = $derived(
    premiereNetworksFor(auth.user?.watchProviderIds ?? []),
  );
  let mineOnly = $state(false);
  const shown = $derived(
    mineOnly ? premieres.filter((p) => myNetworks.has(p.networkId)) : premieres,
  );
  const mineCount = $derived(
    premieres.filter((p) => myNetworks.has(p.networkId)).length,
  );

  // Read once: a page left open past midnight keeps yesterday's grouping
  // until it is reloaded, as the calendar does.
  const now = new Date();
  const schedule = $derived(groupPremieres(shown, now));
  const headliner = $derived(pickHeadliner(shown, now));
  const nextPremiere = $derived(
    shown.find((p) => premiereOffset(p, now) > 0) ?? null,
  );

  const GLOBAL_NETWORKS = new Set(
    PREMIERE_NETWORKS.filter((n) => n.global).map((n) => n.id),
  );
  /** A worldwide streamer's date is everyone's; any other is its country's. */
  const originLabel = (p: PremiereDto) =>
    GLOBAL_NETWORKS.has(p.networkId) || p.originCountries.length === 0
      ? null
      : m.calendar_premieres_origin({
          country: formatRegion(p.originCountries[0]),
        });

  const SHORT_DAY: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };
  const DAY_MONTH: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };

  function dayLabel(p: PremiereDto): string {
    const offset = premiereOffset(p, now);
    if (offset === 0) return m.common_today();
    if (offset === 1) return m.common_tomorrow();
    return formatDate(premiereDay(p), SHORT_DAY);
  }

  function railTitle(rail: PremiereRail): string {
    switch (rail.kind) {
      case "thisWeek":
        return m.common_this_week();
      case "nextWeek":
        return m.calendar_next_week();
      case "week":
        return m.calendar_premieres_week_range({
          from: formatDate(rail.from, DAY_MONTH),
          to: formatDate(rail.to ?? rail.from, DAY_MONTH),
        });
      case "month":
        return m.calendar_premieres_in_month({
          month: formatDate(rail.from, { month: "long" }),
        });
    }
  }

  const countLabel = (count: number) =>
    count === 1
      ? m.calendar_premieres_count_one()
      : m.calendar_premieres_count_many({ count });
</script>

{#snippet networkBadge(p: PremiereDto)}
  <span
    class="border-accent text-accent rounded border bg-black/75 px-1.5 py-px font-mono text-[0.6rem] font-bold tracking-wide uppercase">
    {p.networkName}
  </span>
{/snippet}

{#snippet tile(p: PremiereDto)}
  {@const origin = originLabel(p)}
  <!-- The home widgets' poster: the frame lights up, nothing moves. -->
  <a href="/app/media/series/{p.sourceId}" class="block w-28 sm:w-32">
    <div
      class="card hover:border-accent relative overflow-hidden transition-[border-color]">
      <Poster src={p.posterUrl} title={p.title} alt="" />
      <span class="absolute bottom-1.5 left-1.5"
        >{@render networkBadge(p)}</span>
    </div>
    <p class="timecode mt-1.5 text-xs">{dayLabel(p)}</p>
    <p class="font-display line-clamp-2 text-xs leading-snug font-semibold">
      {p.title}
    </p>
    {#if origin}
      <p class="text-dim text-micro truncate">{origin}</p>
    {/if}
  </a>
{/snippet}

{#snippet railHeader(title: string, count: number, id: string)}
  <div class="mb-1 flex items-baseline gap-3">
    <h2 {id} class="font-display text-lg font-bold md:text-xl">{title}</h2>
    <span class="timecode ml-auto text-xs">{countLabel(count)}</span>
  </div>
{/snippet}

<div>
  {#if premieresQuery.error}
    <Banner variant="error">{premieresQuery.error}</Banner>
  {:else if premieresQuery.loading}
    <!-- The shape of what loads: the headliner, then rails of posters. -->
    <div class="flex flex-col gap-10" aria-hidden="true">
      <div class="skeleton min-h-72 rounded-2xl md:min-h-80"></div>
      {#each { length: 2 } as _, rail (rail)}
        <div>
          <div class="mb-3 flex items-baseline justify-between">
            <div class="skeleton h-6 w-40 rounded"></div>
            <div class="skeleton h-3 w-20 rounded"></div>
          </div>
          <div class="flex gap-4 overflow-hidden">
            {#each { length: 7 } as _, i (i)}
              <div class="w-28 shrink-0 sm:w-32">
                <div class="skeleton aspect-2/3 w-full rounded-lg"></div>
                <div class="skeleton mt-2 h-3 w-1/2 rounded"></div>
                <div class="skeleton mt-1.5 h-3 w-4/5 rounded"></div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if premieres.length === 0}
    <EmptyState art="calendar">{m.calendar_premieres_empty()}</EmptyState>
  {:else}
    {#if myNetworks.size > 0}
      <div class="mb-6">
        <button
          type="button"
          class="chip {mineOnly ? 'chip-on' : ''}"
          aria-pressed={mineOnly}
          onclick={() => (mineOnly = !mineOnly)}>
          {m.calendar_premieres_filter_mine()} ({mineCount})
        </button>
      </div>
    {/if}

    {#if shown.length === 0}
      <EmptyState>{m.calendar_premieres_mine_empty()}</EmptyState>
    {:else}
      <div class="flex flex-col gap-10">
        {#if headliner}
          {@const origin = originLabel(headliner)}
          <!-- The whole card opens the series: the title's link stretches
               over it, the add button sits above that link. -->
          <article
            class="group/headliner border-border hover:border-accent relative isolate grid min-h-72 items-end overflow-hidden rounded-2xl border transition-[border-color,scale] duration-200 ease-out has-[a:active]:scale-[0.99] motion-reduce:transition-colors md:min-h-80">
            <img
              src={headliner.backdropUrl}
              alt=""
              class="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-200 ease-out group-hover/headliner:scale-[1.03] motion-reduce:transition-none" />
            <div
              class="absolute inset-0 -z-10 bg-linear-to-t from-black/95 via-black/60 to-black/0">
            </div>
            <div class="flex max-w-2xl flex-col gap-2.5 p-5 text-white md:p-7">
              <p
                class="text-accent font-mono text-xs font-bold tracking-widest uppercase">
                {m.calendar_premieres_headliner()} · {dayLabel(headliner)}
              </p>
              <h2
                class="font-display text-2xl leading-tight font-extrabold text-balance md:text-4xl">
                <a
                  href="/app/media/series/{headliner.sourceId}"
                  class="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-white">
                  {headliner.title}
                </a>
              </h2>
              <div class="flex flex-wrap items-center gap-2">
                {@render networkBadge(headliner)}
                <span
                  class="rounded-full border border-white/40 px-2 py-0.5 text-[0.6rem] font-bold uppercase">
                  {m.calendar_premieres_new_series()}
                </span>
                {#if origin}
                  <span class="text-micro text-white/75">{origin}</span>
                {/if}
              </div>
              <p class="line-clamp-3 text-sm text-white/80 md:text-base">
                {headliner.overview}
              </p>
              <div class="relative z-10 mt-1 flex flex-wrap gap-2">
                {#if isTracked(headliner)}
                  <span
                    class="border-success text-success inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold">
                    <Icon name="check" class="h-4 w-4" />
                    {m.calendar_premieres_in_list()}
                  </span>
                {:else}
                  <button
                    type="button"
                    class="btn btn-primary"
                    disabled={addMut.loading}
                    onclick={() => addMut.mutate(headliner)}>
                    <Icon name="plus" class="mr-1 inline h-4 w-4" />
                    {m.media_status_planned()}
                  </button>
                {/if}
              </div>
            </div>
          </article>
        {/if}

        <section aria-labelledby="premieres-today">
          {@render railHeader(
            m.common_today(),
            schedule.today.length,
            "premieres-today",
          )}
          {#if schedule.today.length > 0}
            <Carousel
              items={schedule.today}
              keyOf={(p) => p.sourceId}
              label={m.common_today()}
              card={tile} />
          {:else}
            <p class="text-dim text-sm">
              {m.calendar_premieres_today_none()}
              {#if nextPremiere}
                {m.calendar_premieres_next({
                  title: nextPremiere.title,
                  day: dayLabel(nextPremiere),
                  network: nextPremiere.networkName,
                })}
              {/if}
            </p>
          {/if}
        </section>

        {#each schedule.rails as rail (rail.key)}
          {@const title = railTitle(rail)}
          <section aria-labelledby="premieres-{rail.key}">
            {@render railHeader(
              title,
              rail.items.length,
              `premieres-${rail.key}`,
            )}
            <Carousel
              items={rail.items}
              keyOf={(p) => p.sourceId}
              label={title}
              card={tile} />
          </section>
        {/each}
      </div>
    {/if}
  {/if}

  <p class="text-dim text-micro mt-12">{m.calendar_premieres_attribution()}</p>
</div>
