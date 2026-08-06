<script lang="ts">
  // "Social": what the P4 surface actually produced, instance-wide. Only
  // mounted when the API reports the section enabled (SOCIAL_ENABLED).
  import { getAdminSocialActivityTrend } from "$lib/api/client";
  import HistogramBars from "$lib/components/stats/HistogramBars.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import type { AdminSocialStatsDto } from "@tracklore/shared";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";
  import TrendPeriodCard from "./TrendPeriodCard.svelte";

  let { stats }: { stats: AdminSocialStatsDto } = $props();

  const nf = new Intl.NumberFormat("fr-FR");

  const totals = $derived([
    { value: nf.format(stats.totals.reviews), label: "Critiques" },
    { value: nf.format(stats.totals.comments), label: "Commentaires" },
    { value: nf.format(stats.totals.lists), label: "Listes" },
    { value: nf.format(stats.totals.follows), label: "Follows actifs" },
    { value: nf.format(stats.totals.reactions), label: "Réactions" },
    { value: nf.format(stats.totals.helpfulVotes), label: "Votes utiles" },
    { value: nf.format(stats.totals.blocks), label: "Blocks" },
    {
      value: `${stats.totals.deletedCommentPercent} %`,
      label: "Commentaires supprimés",
    },
  ]);

  const ratingBars = $derived(
    stats.ratings.distribution.map((b) => ({
      label: String(b.rating),
      value: b.count,
    })),
  );

  const contributorItems = $derived(
    stats.topContributors.map((c) => ({
      label: `@${c.username}`,
      value: c.contributions,
    })),
  );

  // Split over every account on the instance — see the API service for why the
  // denominator isn't narrowed to "socially active" accounts.
  const totalAccounts = $derived(stats.contributors + stats.readers);
  const contributorShare = $derived(
    totalAccounts === 0
      ? null
      : Math.round((stats.contributors / totalAccounts) * 100),
  );
</script>

<!-- The mockup showed static totals only; the curve is the addition that tells
     an admin whether the social surface went quiet, so it leads the section. -->
<TrendPeriodCard
  title="Activité sociale"
  description="Critiques + commentaires écrits."
  initial={stats.activity}
  load={getAdminSocialActivityTrend}
  errorMessage="Activité indisponible">
  {#snippet footer(trend)}
    <p class="timecode mt-1.5 text-xs">
      {nf.format(trend.total)} sur la période
    </p>
  {/snippet}
</TrendPeriodCard>

<!-- 8 tiles: the mockup pinned this strip to 2 columns at every width, which
     leaves four rows of pairs on desktop — read as a slip, it follows the
     section's own 2→4 column rhythm here. -->
<div class="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
  {#each totals as t (t.label)}
    <div class="card p-4">
      <StatFigure value={t.value} label={t.label} />
    </div>
  {/each}
</div>

<div class="mt-3.5 grid gap-3.5 lg:grid-cols-3">
  <div class="card border-danger/40 p-4">
    <div class="flex items-baseline gap-2">
      <h3 class="font-display text-[15px] font-bold">Signalements</h3>
      <a
        href="/admin/reports"
        class="link-accent ml-auto text-[11px] font-bold">
        file → Reports
      </a>
    </div>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">Modération.</p>
    <div class="grid grid-cols-2 gap-3">
      <StatFigure
        value={nf.format(stats.reports.pending)}
        label="En attente"
        alert={stats.reports.pending > 0} />
      <StatFigure value={nf.format(stats.reports.resolved)} label="Résolus" />
      <StatFigure
        value={stats.reports.medianResolutionHours === null
          ? "—"
          : `${nf.format(stats.reports.medianResolutionHours)} h`}
        label="Délai médian" />
      <StatFigure
        value={stats.reports.foundedPercent === null
          ? "—"
          : `${stats.reports.foundedPercent} %`}
        label="Taux fondé" />
    </div>
    <p class="text-dim mt-3 text-[11px] italic">
      Par motif : nécessite le champ
      <span class="font-mono not-italic">reasonCategory</span> (backlog).
    </p>
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Notes de l’instance</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      Distribution globale{stats.ratings.average === null
        ? ""
        : ` · moyenne ${nf.format(stats.ratings.average)}`} ·
      {nf.format(stats.ratings.total)} critique{stats.ratings.total > 1
        ? "s"
        : ""}.
    </p>
    <HistogramBars bars={ratingBars} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">Top contributeurs</h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      Critiques + commentaires.
    </p>
    <RankBars items={contributorItems} />
    <div class="mt-3">
      <StatFigure
        value={contributorShare === null
          ? "—"
          : `${contributorShare} % / ${100 - contributorShare} %`}
        label="Contributeurs / lecteurs ({nf.format(
          stats.contributors,
        )} sur {nf.format(totalAccounts)} comptes)" />
    </div>
  </div>
</div>
