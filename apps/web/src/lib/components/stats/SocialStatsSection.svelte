<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // "Social" section of /stats — gated by SOCIAL_ENABLED (see the page,
  // this component is only mounted when appConfig.socialEnabled is true).
  // Always cross-domain, not affected by the DomainFilter.
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getSocialStats } from "$lib/api/stats";
  import {
    MONTH_SHORT_OPTIONS,
    PERCENT_OPTIONS,
    formatDate,
    formatNumber,
  } from "$lib/format";
  import type { SocialStatsDto } from "@loomkeep/shared";
  import LineChart from "./LineChart.svelte";
  import StatTile from "./StatTile.svelte";

  let { locked }: { locked: boolean } = $props();

  const socialStats = createApiQuery(() => ({
    key: keys.stats.social(),
    fetch: getSocialStats,
  }));

  // Static, made-up preview shown instead of the real (redacted) section
  // when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment. Everything here is fabricated, but
  // the whole template below reads from `social`, so faking the entire
  // DTO once is simpler than patching every field individually.
  const FAKE_SOCIAL: SocialStatsDto = {
    reviewsWritten: 6,
    avgReviewLength: 180,
    ratingVsCommunity: {
      sufficientData: true,
      yourAverage: 7.4,
      communityAverage: 6.8,
      sampleSize: 14,
    },
    commentsWritten: 12,
    rootCommentsCount: 8,
    replyCommentsCount: 4,
    spoilerCommentRatio: 0.2,
    reviewRevisionsCount: 2,
    helpfulVotesReceived: 9,
    mostVotedReviewVotes: 5,
    reactionsGiven: 15,
    reactionsReceived: 11,
    listsWritten: 3,
    listsPublicCount: 2,
    newFollowersByMonth: [4, 6, 3, 8, 5, 7, 9, 4, 6, 10, 8, 7].map(
      (count, i) => ({
        month: `2026-${String(i + 1).padStart(2, "0")}`,
        count,
      }),
    ),
    followerReciprocityRate: 0.6,
    socialActivityByMonth: [3, 5, 2, 6, 4, 5, 7, 3, 4, 8, 6, 5].map(
      (count, i) => ({
        month: `2026-${String(i + 1).padStart(2, "0")}`,
        count,
      }),
    ),
    contributionStreakDays: 5,
  };

  const social = $derived(locked ? FAKE_SOCIAL : socialStats.data);
  const error = $derived(locked ? null : socialStats.error);

  /** How the viewer's average reads against the community's. */
  function verdict(delta: number): string {
    if (delta < 0) return m.stats_social_stricter();
    if (delta > 0) return m.stats_social_more_generous();
    return m.stats_social_aligned();
  }

  const toPoints = (rows: { month: string; count: number }[]) =>
    rows.map((r) => ({
      label: formatDate(`${r.month}-01T00:00:00Z`, MONTH_SHORT_OPTIONS),
      value: r.count,
    }));
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if social}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={social.reviewsWritten}
      label={m.stats_social_reviews()}
      hint={social.avgReviewLength !== null
        ? social.avgReviewLength === 1
          ? m.stats_social_review_length_one({ count: social.avgReviewLength })
          : m.stats_social_review_length({ count: social.avgReviewLength })
        : undefined} />
    <StatTile
      value={social.commentsWritten}
      label={m.common_comments()}
      hint={m.stats_social_spoiler_ratio({
        percent: formatNumber(social.spoilerCommentRatio, PERCENT_OPTIONS),
      })} />
    <StatTile
      value={social.helpfulVotesReceived}
      label={m.stats_social_helpful_votes()}
      hint={social.mostVotedReviewVotes !== null
        ? m.stats_social_top_review_votes({
            count: social.mostVotedReviewVotes,
          })
        : undefined} />
    <StatTile
      value={social.listsWritten}
      label={m.stats_social_lists()}
      hint={social.listsPublicCount === 1
        ? m.stats_social_public_list({ count: social.listsPublicCount })
        : m.stats_social_public_lists({ count: social.listsPublicCount })} />
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        {m.stats_social_comments_breakdown()}
      </h3>
      <div class="flex items-baseline gap-6">
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.rootCommentsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            {m.stats_social_root_comments()}
          </p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.replyCommentsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            {m.common_replies()}
          </p>
        </div>
      </div>
    </section>

    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        {m.stats_social_revisions_reactions()}
      </h3>
      <div class="flex flex-wrap items-baseline gap-6">
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reviewRevisionsCount}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            {m.stats_social_review_revisions()}
          </p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reactionsGiven}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            {m.stats_social_reactions_given()}
          </p>
        </div>
        <div>
          <p class="font-display text-2xl font-extrabold tabular-nums">
            {social.reactionsReceived}
          </p>
          <p class="text-dim text-xs tracking-wide uppercase">
            {m.stats_social_reactions_received()}
          </p>
        </div>
      </div>
    </section>
  </div>

  <section class="card mt-5 p-5">
    <h3 class="font-display text-lg font-bold">
      {m.stats_social_rating_comparison()}
    </h3>
    {#if social.ratingVsCommunity.sufficientData}
      {@const cmp = social.ratingVsCommunity}
      {@const delta =
        Math.round((cmp.yourAverage - cmp.communityAverage) * 10) / 10}
      <p class="text-dim mb-3 text-sm">
        {m.stats_social_comparison_sample({ count: cmp.sampleSize })}
      </p>
      <span class="chip chip-on mb-3 inline-block text-xs">
        {Math.abs(delta) === 1
          ? m.stats_social_delta_one({
              delta: formatNumber(delta, { signDisplay: "exceptZero" }),
              verdict: verdict(delta),
            })
          : m.stats_social_delta_many({
              delta: formatNumber(delta, { signDisplay: "exceptZero" }),
              verdict: verdict(delta),
            })}
      </span>
      <div class="bg-surface-2 relative h-2 rounded-full">
        <span
          class="border-fg absolute top-1/2 h-3 w-0.5 -translate-y-1/2 border-l-2"
          style="left:{(cmp.communityAverage / 10) * 100}%"
          title={m.stats_social_community_rating({
            rating: formatNumber(cmp.communityAverage),
          })}></span>
        <span
          class="bg-accent absolute top-1/2 h-3 w-0.5 -translate-y-1/2"
          style="left:{(cmp.yourAverage / 10) * 100}%"
          title={m.stats_social_your_rating({
            rating: formatNumber(cmp.yourAverage),
          })}></span>
      </div>
      <p class="timecode mt-2 text-xs">
        {m.stats_social_comparison_summary({
          yours: formatNumber(cmp.yourAverage),
          community: formatNumber(cmp.communityAverage),
        })}
      </p>
    {:else}
      <p class="text-dim text-sm">
        {m.stats_social_insufficient_comparison({
          count: social.ratingVsCommunity.sampleSize,
        })}
      </p>
    {/if}
  </section>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        {m.stats_social_new_followers()}
      </h3>
      <p class="text-dim mb-3 text-xs">
        {m.stats_social_reciprocity({
          percent: formatNumber(
            social.followerReciprocityRate,
            PERCENT_OPTIONS,
          ),
        })}
      </p>
      <LineChart
        points={toPoints(social.newFollowersByMonth)}
        color="var(--accent)" />
    </section>
    <section class="card p-5">
      <div class="mb-4 flex items-baseline justify-between">
        <h3 class="font-display text-lg font-bold">
          {m.stats_social_monthly_activity()}
        </h3>
        {#if social.contributionStreakDays > 0}
          <span class="text-dim text-xs"
            >{m.stats_social_current_streak_label()}
            <b class="text-fg"
              >{m.common_day_count_short({
                days: social.contributionStreakDays,
              })}</b
            ></span>
        {/if}
      </div>
      <LineChart
        points={toPoints(social.socialActivityByMonth)}
        color="var(--accent)" />
    </section>
  </div>
{/if}
