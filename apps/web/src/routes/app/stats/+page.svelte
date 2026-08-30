<script lang="ts">
  import { resolveApiError } from "$lib/api/errors";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import {
    getStatsOverview,
    getStatsWorksByDecade,
    getStatsWorksByRating,
  } from "$lib/api/stats";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PremiumTeaser from "$lib/components/PremiumTeaser.svelte";
  import BookStatsSection from "$lib/components/stats/BookStatsSection.svelte";
  import DomainFilter from "$lib/components/stats/DomainFilter.svelte";
  import GameStatsSection from "$lib/components/stats/GameStatsSection.svelte";
  import HistogramBars from "$lib/components/stats/HistogramBars.svelte";
  import InsufficientDataNotice from "$lib/components/stats/InsufficientDataNotice.svelte";
  import MusicStatsSection from "$lib/components/stats/MusicStatsSection.svelte";
  import PeriodFilter from "$lib/components/stats/PeriodFilter.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import SectionLabel from "$lib/components/stats/SectionLabel.svelte";
  import SocialStatsSection from "$lib/components/stats/SocialStatsSection.svelte";
  import StackedBar from "$lib/components/stats/StackedBar.svelte";
  import StatTile from "$lib/components/stats/StatTile.svelte";
  import StatsWorksModal from "$lib/components/stats/StatsWorksModal.svelte";
  import VideoStatsSection from "$lib/components/stats/VideoStatsSection.svelte";
  import VideoTemporalSection from "$lib/components/stats/VideoTemporalSection.svelte";
  import { POSSESSION_STATUS_LABEL } from "$lib/components/stats/possession-labels";
  import {
    STATS_DOMAIN_COLOR_VAR,
    STATS_DOMAIN_LABEL,
    STATUS_BUCKET_COLOR,
    STATUS_BUCKET_LABEL,
    STATUS_BUCKET_ORDER,
  } from "$lib/components/stats/stats-domain";
  import { appConfig } from "$lib/config.svelte";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { formatNumber, PERCENT_OPTIONS } from "$lib/format";
  import { m } from "$lib/paraglide/messages";
  import type {
    StatsDomain,
    StatsWindow,
    StatsWorkDto,
  } from "@loomkeep/shared";
  import { STATS_DOMAINS } from "@loomkeep/shared";

  type Choice = "ALL" | StatsDomain;

  const enabledDomains = $derived<StatsDomain[]>(
    STATS_DOMAINS.filter((d) => auth.user?.enabledDomains?.includes(d) ?? true),
  );

  // Gates the "deep analysis" stats (rankings, distributions, temporal
  // breakdowns) — the "counting" stats stay free everywhere. stats.service.ts
  // redacts the advanced fields server-side for a non-premium account (see
  // feature plan); this flag only drives which sections show a fake/blurred
  // preview instead of the (already-empty) real data.
  const statsLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );

  let selected = $state<Choice>("ALL");
  // Narrows the "Activité dans le temps" weekday/hour curves only — see
  // PeriodFilter.
  let period = $state<StatsWindow>("ALL");

  const overviewQuery = createApiQuery(() => ({
    key: keys.stats.overview(selected),
    fetch: () => getStatsOverview(selected),
  }));
  const overview = $derived(overviewQuery.data);
  const error = $derived(overviewQuery.error);

  // "Tous" shows the domain split; a single domain shows its status funnel.
  const compositionSegments = $derived.by(() => {
    if (!overview) return [];
    const { breakdowns } = overview;
    if (selected === "ALL") {
      return breakdowns.map((b) => ({
        label: STATS_DOMAIN_LABEL[b.domain],
        color: STATS_DOMAIN_COLOR_VAR[b.domain],
        value: b.total,
      }));
    }
    return STATUS_BUCKET_ORDER.map((bucket) => ({
      label: STATUS_BUCKET_LABEL[bucket],
      color: STATUS_BUCKET_COLOR[bucket],
      value:
        breakdowns[0]?.byStatus.find((s) => s.bucket === bucket)?.count ?? 0,
    }));
  });

  // Static, made-up datasets shown instead of the real (redacted) ones when
  // `statsLocked` — the API already zeroes/empties these fields for a
  // non-premium account (see stats.service.ts), so there's nothing real to
  // show; a plausible-looking fake chart previews the shape of what's
  // behind the paywall better than an empty or generic placeholder would.
  const FAKE_RATING_BARS = [2, 3, 5, 8, 12, 15, 11, 9, 6, 3].map(
    (value, i) => ({ label: String(i + 1), value }),
  );
  const FAKE_DECADE_BARS = [
    { label: "1990", value: 4 },
    { label: "2000", value: 9 },
    { label: "2010", value: 14 },
    { label: "2020", value: 7 },
  ];
  const FAKE_POSSESSION_BARS = [
    { label: m.stats_ownership_owned(), value: 18 },
    { label: m.stats_ownership_borrowed(), value: 6 },
    { label: m.stats_ownership_streaming(), value: 11 },
  ];

  const ratingBars = $derived(
    statsLocked
      ? FAKE_RATING_BARS
      : overview
        ? overview.ratingDistribution.map((b) => ({
            label: String(b.rating),
            value: b.count,
          }))
        : [],
  );
  const decadeBars = $derived(
    statsLocked
      ? FAKE_DECADE_BARS
      : overview
        ? overview.decades.map((b) => ({
            label: String(b.decade),
            value: b.count,
          }))
        : [],
  );
  const possessionBars = $derived(
    statsLocked
      ? FAKE_POSSESSION_BARS
      : overview?.possession.sufficientData
        ? overview.possession.byStatus
            .map((s) => ({
              label: POSSESSION_STATUS_LABEL[s.status] ?? s.status,
              value: s.count,
            }))
            .sort((a, b) => b.value - a.value)
        : [],
  );

  const isEmpty = $derived(!!overview && overview.total === 0);

  // A domain's deep section shows when the user enabled it and the filter
  // doesn't exclude it; it reuses the status breakdown the overview loaded.
  const showSection = (domain: StatsDomain): boolean =>
    enabledDomains.includes(domain) &&
    (selected === "ALL" || selected === domain);

  const breakdownOf = (domain: StatsDomain) =>
    overview?.breakdowns.find((b) => b.domain === domain);

  // Works drill-down modal, opened from a clicked rating/decade bar.
  let modalOpen = $state(false);
  let modalTitle = $state("");
  let modalWorks = $state<StatsWorkDto[]>([]);
  let modalLoading = $state(false);
  let modalError = $state<string | null>(null);

  function openRatingModal(ratingLabel: string) {
    const rating = Number(ratingLabel);
    modalOpen = true;
    modalLoading = true;
    modalError = null;
    modalTitle = m.stats_modal_rated({ rating });
    getStatsWorksByRating(selected, rating)
      .then((w) => (modalWorks = w))
      .catch((e) => (modalError = resolveApiError(e)))
      .finally(() => (modalLoading = false));
  }

  function openDecadeModal(decadeLabel: string) {
    const decade = Number(decadeLabel);
    modalOpen = true;
    modalLoading = true;
    modalError = null;
    modalTitle = m.stats_modal_released({ decade });
    getStatsWorksByDecade(selected, decade)
      .then((w) => (modalWorks = w))
      .catch((e) => (modalError = resolveApiError(e)))
      .finally(() => (modalLoading = false));
  }
</script>

<!-- Filter console: sticky, the spine that drives everything below. -->
<div
  class="border-border bg-surface/95 sticky top-0 z-20 border-b backdrop-blur">
  <div
    class="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-5 py-3 md:px-8">
    <DomainFilter
      {enabledDomains}
      {selected}
      onSelect={(c) => (selected = c)} />
  </div>
</div>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="stats"
    title={m.common_stats()}
    subtitle={m.stats_subtitle()} />

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if isEmpty}
    <EmptyState>
      {m.stats_empty()}
    </EmptyState>
  {:else if overview}
    <SectionLabel label={m.stats_overview_label()} />
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        value={formatNumber(overview.total)}
        label={m.stats_works_label()} />
      <StatTile
        value={formatNumber(overview.completionRate, PERCENT_OPTIONS)}
        label={m.stats_completion_rate()} />
      <StatTile
        value={formatNumber(overview.abandonRate, PERCENT_OPTIONS)}
        label={m.stats_abandon_rate()} />
      <StatTile
        value={overview.averageRating ?? "—"}
        unit="/10"
        label={m.stats_avg_rating()} />
    </div>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <section class="card p-5">
        <h2 class="font-display mb-4 text-lg font-bold">
          {selected === "ALL" ? m.stats_composition() : m.stats_progression()}
        </h2>
        <StackedBar segments={compositionSegments} />
      </section>

      <PremiumTeaser locked={statsLocked}>
        <section class="card p-5">
          <h2 class="font-display mb-4 text-lg font-bold">
            {m.stats_rating_distribution()}
          </h2>
          {#if statsLocked || overview.ratedCount > 0}
            <HistogramBars bars={ratingBars} onSelect={openRatingModal} />
          {:else}
            <p class="text-dim text-sm">{m.stats_no_rated()}</p>
          {/if}
        </section>
      </PremiumTeaser>
    </div>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <PremiumTeaser locked={statsLocked}>
        <section class="card p-5">
          <h2 class="font-display mb-4 text-lg font-bold">
            {m.stats_decade()}
          </h2>
          {#if statsLocked || decadeBars.length > 0}
            <HistogramBars bars={decadeBars} onSelect={openDecadeModal} />
          {:else}
            <p class="text-dim text-sm">{m.stats_no_decade()}</p>
          {/if}
        </section>
      </PremiumTeaser>

      <PremiumTeaser locked={statsLocked}>
        <section class="card p-5">
          <h2 class="font-display mb-4 text-lg font-bold">
            {m.stats_possession()}
          </h2>
          {#if statsLocked || overview.possession.sufficientData}
            <RankBars items={possessionBars} />
          {:else}
            <InsufficientDataNotice
              renseignedRatio={overview.possession.renseignedRatio} />
          {/if}
        </section>
      </PremiumTeaser>
    </div>

    {#if showSection("MEDIA")}
      <SectionLabel
        label="{m.common_Media()}{m.stats_detail_suffix()}"
        class="mt-10" />
      <VideoStatsSection
        mediaBreakdown={breakdownOf("MEDIA")}
        locked={statsLocked} />
    {/if}

    {#if showSection("GAMES")}
      <SectionLabel
        label="{m.common_Games()}{m.stats_detail_suffix()}"
        class="mt-10" />
      <GameStatsSection
        gameBreakdown={breakdownOf("GAMES")}
        locked={statsLocked} />
    {/if}

    {#if showSection("BOOKS")}
      <SectionLabel
        label="{m.common_Books()}{m.stats_detail_suffix()}"
        class="mt-10" />
      <BookStatsSection
        bookBreakdown={breakdownOf("BOOKS")}
        locked={statsLocked} />
    {/if}

    {#if showSection("MUSIC")}
      <SectionLabel
        label="{m.common_Music()}{m.stats_detail_suffix()}"
        class="mt-10" />
      <MusicStatsSection
        musicBreakdown={breakdownOf("MUSIC")}
        locked={statsLocked} />
    {/if}

    <!-- Entirely premium sections come last: a free account sees plenty of
         real content first, rather than landing on a locked block right
         after the overview. -->
    {#if showSection("MEDIA")}
      <div class="mt-10 flex flex-wrap items-center gap-3">
        <SectionLabel label={m.stats_temporal_section()} class="mb-0 flex-1" />
        {#if !statsLocked}
          <PeriodFilter selected={period} onSelect={(w) => (period = w)} />
        {/if}
      </div>
      <PremiumTeaser locked={statsLocked} class="mt-4 block">
        <VideoTemporalSection {period} locked={statsLocked} />
      </PremiumTeaser>
    {/if}

    {#if appConfig.socialEnabled}
      <SectionLabel label={m.stats_social()} class="mt-10" />
      <PremiumTeaser locked={statsLocked}>
        <SocialStatsSection locked={statsLocked} />
      </PremiumTeaser>
    {/if}
  {/if}
</div>

{#if modalOpen}
  <StatsWorksModal
    title={modalTitle}
    works={modalWorks}
    loading={modalLoading}
    error={modalError}
    onclose={() => (modalOpen = false)} />
{/if}
