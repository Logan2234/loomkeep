<script lang="ts">
  // "Social": what the P4 surface actually produced, instance-wide. Only
  // mounted when the API reports the section enabled (SOCIAL_ENABLED).
  import { getAdminSocialActivityTrend } from "$lib/api/client";
  import HistogramBars from "$lib/components/stats/HistogramBars.svelte";
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";
  import { REPORT_CATEGORY_LABELS } from "$lib/constants/report-labels";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import type { AdminSocialStatsDto } from "@loomkeep/shared";
  import TrendPeriodCard from "./TrendPeriodCard.svelte";

  let { stats }: { stats: AdminSocialStatsDto } = $props();

  const totals = $derived([
    {
      value: formatNumber(stats.totals.reviews),
      label: m.profile_reviews_count_plural(),
    },
    {
      value: formatNumber(stats.totals.comments),
      label: m.admin_social_total_comments(),
    },
    { value: formatNumber(stats.totals.lists), label: m.profile_lists_title() },
    {
      value: formatNumber(stats.totals.follows),
      label: m.admin_social_total_follows(),
    },
    {
      value: formatNumber(stats.totals.reactions),
      label: m.admin_social_total_reactions(),
    },
    {
      value: formatNumber(stats.totals.helpfulVotes),
      label: m.admin_social_total_helpful_votes(),
    },
    {
      value: formatNumber(stats.totals.blocks),
      label: m.admin_social_total_blocks(),
    },
    {
      value: `${stats.totals.deletedCommentPercent} %`,
      label: m.admin_social_total_deleted_comments(),
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

  const categoryItems = $derived(
    stats.reports.byCategory.map((c) => ({
      label: REPORT_CATEGORY_LABELS[c.category],
      value: c.count,
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
  title={m.admin_social_activity_title()}
  description={m.admin_social_activity_desc()}
  initial={stats.activity}
  load={getAdminSocialActivityTrend}
  errorMessage={m.admin_social_activity_error()}>
  {#snippet footer(trend)}
    <p class="timecode mt-1.5 text-xs">
      {m.admin_social_activity_footer({ count: formatNumber(trend.total) })}
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
      <h3 class="font-display text-[15px] font-bold">
        {m.admin_social_reports_title()}
      </h3>
      <a
        href="/app/admin/reports"
        class="link-accent ml-auto text-[11px] font-bold">
        {m.admin_social_reports_queue_link()}
      </a>
    </div>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_social_moderation()}
    </p>
    <div class="grid grid-cols-2 gap-3">
      <StatFigure
        value={formatNumber(stats.reports.pending)}
        label={m.admin_social_reports_pending()}
        alert={stats.reports.pending > 0} />
      <StatFigure
        value={formatNumber(stats.reports.resolved)}
        label={m.admin_social_reports_resolved()} />
      <StatFigure
        value={stats.reports.medianResolutionHours === null
          ? "—"
          : `${formatNumber(stats.reports.medianResolutionHours)} h`}
        label={m.admin_social_reports_median_delay()} />
      <StatFigure
        value={stats.reports.foundedPercent === null
          ? "—"
          : `${stats.reports.foundedPercent} %`}
        label={m.admin_social_reports_founded_rate()} />
    </div>
    {#if categoryItems.length > 0}
      <p class="text-dim mt-3.5 mb-2 text-[11px] font-bold uppercase">
        {m.admin_social_by_category()}
      </p>
      <RankBars items={categoryItems} />
    {/if}
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_social_ratings_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_social_ratings_desc({
        avgPart:
          stats.ratings.average === null
            ? ""
            : m.admin_social_ratings_avg_suffix({
                avg: formatNumber(stats.ratings.average),
              }),
        total: formatNumber(stats.ratings.total),
        reviewWord:
          stats.ratings.total > 1
            ? m.profile_reviews_count_plural()
            : m.profile_reviews_count_singular(),
      })}
    </p>
    <HistogramBars bars={ratingBars} />
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_social_top_contributors_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_social_top_contributors_desc()}
    </p>
    <RankBars items={contributorItems} />
    <div class="mt-3">
      <StatFigure
        value={contributorShare === null
          ? "—"
          : `${contributorShare} % / ${100 - contributorShare} %`}
        label={m.admin_social_contributors_readers({
          contributors: formatNumber(stats.contributors),
          total: formatNumber(totalAccounts),
        })} />
    </div>
  </div>
</div>
