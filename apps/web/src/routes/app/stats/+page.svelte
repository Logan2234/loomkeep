<script lang="ts">
  import { ApiError } from "$lib/api/core";
  import {
    getStatsOverview,
    getStatsWorksByDecade,
    getStatsWorksByRating,
  } from "$lib/api/stats";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
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
  import { m } from "$lib/paraglide/messages";
  import type {
    StatsDomain,
    StatsOverviewDto,
    StatsWindow,
    StatsWorkDto,
  } from "@loomkeep/shared";
  import { STATS_DOMAINS } from "@loomkeep/shared";

  type Choice = "ALL" | StatsDomain;

  const enabledDomains = $derived<StatsDomain[]>(
    STATS_DOMAINS.filter((d) => auth.user?.enabledDomains?.includes(d) ?? true),
  );

  let selected = $state<Choice>("ALL");
  // Narrows the "Activité dans le temps" weekday/hour curves only — see
  // PeriodFilter.
  let period = $state<StatsWindow>("ALL");
  let overview = $state<StatsOverviewDto | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    const domain = selected;
    error = null;
    getStatsOverview(domain)
      .then((o) => (overview = o))
      .catch((e) => {
        error =
          e instanceof ApiError ? e.message : "Statistiques indisponibles";
      });
  });

  const nf = new Intl.NumberFormat("fr-FR");
  const pf = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  });

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

  const ratingBars = $derived(
    overview
      ? overview.ratingDistribution.map((b) => ({
          label: String(b.rating),
          value: b.count,
        }))
      : [],
  );
  const decadeBars = $derived(
    overview
      ? overview.decades.map((b) => ({
          label: String(b.decade),
          value: b.count,
        }))
      : [],
  );
  const possessionBars = $derived(
    overview?.possession.sufficientData
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
  function showSection(domain: StatsDomain): boolean {
    return (
      enabledDomains.includes(domain) &&
      (selected === "ALL" || selected === domain)
    );
  }

  function breakdownOf(domain: StatsDomain) {
    return overview?.breakdowns.find((b) => b.domain === domain);
  }

  // Works drill-down modal, opened from a clicked rating/decade bar.
  let modalOpen = $state(false);
  let modalTitle = $state("");
  let modalWorks = $state<StatsWorkDto[]>([]);
  let modalLoading = $state(false);

  function openRatingModal(ratingLabel: string) {
    const rating = Number(ratingLabel);
    modalOpen = true;
    modalLoading = true;
    modalTitle = `Notées ${rating}/10`;
    getStatsWorksByRating(selected, rating)
      .then((w) => (modalWorks = w))
      .finally(() => (modalLoading = false));
  }

  function openDecadeModal(decadeLabel: string) {
    const decade = Number(decadeLabel);
    modalOpen = true;
    modalLoading = true;
    modalTitle = `Sorties dans les années ${decade}`;
    getStatsWorksByDecade(selected, decade)
      .then((w) => (modalWorks = w))
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
    <PeriodFilter selected={period} onSelect={(w) => (period = w)} />
  </div>
</div>

<div class="mx-auto max-w-4xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="stats"
    title={m.common_stats()}
    subtitle="Ton activité en un coup d'œil." />

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if isEmpty}
    <EmptyState>
      Rien à afficher pour l'instant. Marque des œuvres pour voir tes
      statistiques.
    </EmptyState>
  {:else if overview}
    <SectionLabel label="Vue d'ensemble" />
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile value={nf.format(overview.total)} label="Œuvres" />
      <StatTile
        value={pf.format(overview.completionRate)}
        label="Taux de complétion" />
      <StatTile
        value={pf.format(overview.abandonRate)}
        label="Taux d'abandon" />
      <StatTile
        value={overview.averageRating ?? "—"}
        unit="/10"
        label="Note moyenne · {pf.format(overview.ratingRate)} noté" />
    </div>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <section class="card p-5">
        <h2 class="font-display mb-4 text-lg font-bold">
          {selected === "ALL" ? "Composition" : "Progression"}
        </h2>
        <StackedBar segments={compositionSegments} />
      </section>

      <section class="card p-5">
        <h2 class="font-display mb-4 text-lg font-bold">
          Distribution des notes
        </h2>
        {#if overview.ratedCount > 0}
          <HistogramBars bars={ratingBars} onSelect={openRatingModal} />
        {:else}
          <p class="text-dim text-sm">Aucune œuvre notée pour l'instant.</p>
        {/if}
      </section>
    </div>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <section class="card p-5">
        <h2 class="font-display mb-4 text-lg font-bold">Décennie de sortie</h2>
        {#if decadeBars.length > 0}
          <HistogramBars bars={decadeBars} onSelect={openDecadeModal} />
        {:else}
          <p class="text-dim text-sm">Aucune date de sortie connue.</p>
        {/if}
      </section>

      <section class="card p-5">
        <h2 class="font-display mb-4 text-lg font-bold">Mode de possession</h2>
        {#if overview.possession.sufficientData}
          <RankBars items={possessionBars} />
        {:else}
          <InsufficientDataNotice
            renseignedRatio={overview.possession.renseignedRatio} />
        {/if}
      </section>
    </div>

    {#if showSection("MEDIA")}
      <SectionLabel label="Activité dans le temps" class="mt-10" />
      <VideoTemporalSection {period} />

      <SectionLabel label="{m.common_Media()} — en détail" class="mt-10" />
      <VideoStatsSection mediaBreakdown={breakdownOf("MEDIA")} />
    {/if}

    {#if showSection("GAMES")}
      <SectionLabel label="{m.common_Games()} — en détail" class="mt-10" />
      <GameStatsSection gameBreakdown={breakdownOf("GAMES")} />
    {/if}

    {#if showSection("BOOKS")}
      <SectionLabel label="{m.common_Books()} — en détail" class="mt-10" />
      <BookStatsSection bookBreakdown={breakdownOf("BOOKS")} />
    {/if}

    {#if showSection("MUSIC")}
      <SectionLabel label="{m.common_Music()} — en détail" class="mt-10" />
      <MusicStatsSection musicBreakdown={breakdownOf("MUSIC")} />
    {/if}

    {#if appConfig.socialEnabled}
      <SectionLabel label="Social" class="mt-10" />
      <SocialStatsSection />
    {/if}
  {/if}
</div>

{#if modalOpen}
  <StatsWorksModal
    title={modalTitle}
    works={modalWorks}
    loading={modalLoading}
    onclose={() => (modalOpen = false)} />
{/if}
