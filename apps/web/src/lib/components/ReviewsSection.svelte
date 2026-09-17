<script lang="ts">
  import {
    getMyReview,
    getReviewsForTarget,
    reportReview,
    unvoteReview,
    voteReview,
  } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    arrangeReviews,
    summarizeReviews,
    type ReviewArrangement,
  } from "$lib/review-community";
  import { toast } from "$lib/toast.svelte";
  import type {
    ReportCategory,
    ReportMotif,
    ReviewDto,
    ReviewTargetType,
    ReviewVoteValue,
  } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";
  import ReportModal from "./ReportModal.svelte";
  import ReviewCard from "./ReviewCard.svelte";
  import ReviewFormModal from "./ReviewFormModal.svelte";
  import { useQueryClient } from "@tanstack/svelte-query";
  import type { Snippet } from "svelte";

  // Always-visible review section for a work's detail page: a community
  // summary, the viewer's own review (add/edit via the shared modal) and
  // everyone else's, visibility-filtered server-side. Anchored at the very
  // bottom of the page — or, for a season/episode target, embedded directly
  // inside a Modal (EpisodesSection), in which case `compact` drops the top
  // margin the Modal's own heading already accounts for.
  let {
    targetType,
    targetId,
    workTitle,
    workMeta,
    workImageUrl,
    compact = false,
    actions,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
    workTitle: string;
    /** Forwarded to the review modal's timecode line. */
    workMeta?: string;
    /** Forwarded to the review modal's thumbnail. */
    workImageUrl?: string | null;
    compact?: boolean;
    actions?: Snippet;
  } = $props();

  // Below this, an average and a histogram say less than the cards do.
  const SUMMARY_MIN_REVIEWS = 3;
  const HISTOGRAM_HEIGHT_PX = 70;

  const queryClient = useQueryClient();

  const myReviewQuery = createApiQuery(() => ({
    key: keys.reviews.mine(targetType, targetId),
    fetch: () => getMyReview(targetType, targetId),
  }));
  const myReview = $derived(myReviewQuery.data);
  const myReviewLoaded = $derived(!myReviewQuery.loading);

  const communityQuery = createApiQuery(() => ({
    key: keys.reviews.community(targetType, targetId),
    fetch: () => getReviewsForTarget(targetType, targetId),
    enabled: appConfig.socialEnabled,
  }));
  const allReviews = $derived(communityQuery.data ?? []);
  const communityLoaded = $derived(!communityQuery.loading);

  let editing = $state(false);
  let reportingId = $state<string | null>(null);
  let arrangement = $state<ReviewArrangement>("useful");

  // `listForTarget` always includes the viewer's own review — keep the
  // community list to everyone else so it isn't shown twice. The summary
  // takes the viewer's review from its own query, which a save updates
  // immediately, instead of the community copy fetched before it.
  const othersReviews = $derived(
    allReviews.filter((r) => r.author?.id !== auth.user?.id),
  );
  const summary = $derived(
    summarizeReviews(myReview ? [myReview, ...othersReviews] : othersReviews),
  );
  const showSummary = $derived(summary.count >= SUMMARY_MIN_REVIEWS);
  const mostCommon = $derived(Math.max(...summary.distribution));
  const myBucket = $derived(myReview ? Math.round(myReview.rating) : null);
  const shownOthers = $derived(arrangeReviews(othersReviews, arrangement));
  const showMineInList = $derived(!!myReview && arrangement !== "friends");

  const ARRANGEMENTS: { value: ReviewArrangement; label: () => string }[] = [
    { value: "useful", label: m.reviews_sort_useful },
    { value: "recent", label: m.reviews_sort_recent },
    { value: "friends", label: m.common_friends },
  ];

  function formatAverage(value: number): string {
    return formatNumber(value, { maximumFractionDigits: 1 });
  }

  function handleSaved(updated: ReviewDto) {
    queryClient.setQueryData(keys.reviews.mine(targetType, targetId), updated);
  }

  function handleDeleted() {
    queryClient.setQueryData(keys.reviews.mine(targetType, targetId), null);
  }

  // Reddit-style: clicking the already-active direction removes the vote,
  // clicking the other one replaces it. One in-flight vote at a time.
  const voteMut = createApiMutation(() => ({
    mutate: async (args: { review: ReviewDto; value: ReviewVoteValue }) => {
      if (args.review.myVote === args.value) {
        const { score } = await unvoteReview(args.review.id);
        return { score, myVote: null as ReviewVoteValue | null };
      }
      const { score, myVote } = await voteReview(args.review.id, args.value);
      return { score, myVote };
    },
    onSuccess: (result, args) => {
      queryClient.setQueryData(
        keys.reviews.community(targetType, targetId),
        (old: ReviewDto[] | undefined) =>
          old?.map((r) =>
            r.id === args.review.id
              ? { ...r, voteScore: result.score, myVote: result.myVote }
              : r,
          ),
      );
    },
  }));

  function isVoting(id: string): boolean {
    return voteMut.loading && voteMut.variables?.review.id === id;
  }

  async function submitReport(report: {
    category: ReportCategory;
    motif?: ReportMotif;
    reason?: string;
  }) {
    if (!reportingId) return;
    try {
      await reportReview(
        reportingId,
        report.category,
        report.motif,
        report.reason,
      );
      toast.success(m.reviews_reported());
    } catch (err) {
      toast.error(resolveApiError(err));
    } finally {
      reportingId = null;
    }
  }
</script>

<section class={compact ? "" : "mt-6"}>
  <div class="mb-3 flex items-center gap-2">
    <h2
      class="font-display flex min-w-0 flex-1 items-center gap-2 text-xl font-bold">
      {#if appConfig.socialEnabled}
        {m.reviews_section_community_title({ count: othersReviews.length })}
      {:else}
        {m.reviews_section_my_review_title()}
      {/if}
      {#if isFeatureNew("reviews-redesign")}
        <NewBadge />
      {/if}
    </h2>
    <div class="flex shrink-0 items-center gap-1">
      {#if actions}
        {@render actions()}
      {/if}
      {#if myReviewLoaded}
        <button class="btn btn-ghost btn-sm" onclick={() => (editing = true)}>
          {myReview ? m.common_edit() : m.common_add()}
        </button>
      {/if}
    </div>
  </div>

  <div class="flex flex-col gap-2.5">
    {#if appConfig.socialEnabled && showSummary}
      <div class="card grid grid-cols-[auto_1fr] items-center gap-[18px] p-4">
        <div class="flex flex-col items-start">
          <span
            class="font-display text-[2.6rem] leading-none font-extrabold tabular-nums">
            {formatAverage(summary.average!)}<span
              class="timecode text-[0.8rem] font-normal">&nbsp;/10</span>
          </span>
          <span class="text-dim mt-1 text-xs">
            {summary.count === 1
              ? m.reviews_count_one({ count: summary.count })
              : m.reviews_count_other({ count: summary.count })}
          </span>
          {#if summary.friendsAverage !== null}
            <span
              class="mt-2 flex items-center gap-1.5 text-xs"
              title={m.reviews_friends_average()}>
              <Icon name="users" class="text-dim h-3.5 w-3.5" />
              {m.common_friends()}
              <b class="text-accent font-mono">
                {formatAverage(summary.friendsAverage)}
              </b>
            </span>
          {/if}
        </div>

        <div
          class="grid h-[86px] grid-cols-11 items-end gap-[3px]"
          role="img"
          aria-label={m.reviews_distribution_label()}>
          {#each summary.distribution as count, rating (rating)}
            <div
              class="flex h-full flex-col items-center justify-end gap-[3px]"
              title={m.reviews_distribution_bar({ count, rating })}>
              <i
                class="block min-h-0.5 w-full rounded-t-[3px]"
                class:histogram-bar={count !== mostCommon}
                class:bg-accent={count === mostCommon}
                class:ring-fg={rating === myBucket}
                class:ring-2={rating === myBucket}
                class:ring-inset={rating === myBucket}
                style="height: {(count / mostCommon) * HISTOGRAM_HEIGHT_PX}px"
              ></i>
              <span class="timecode text-[0.6rem]">{rating}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if appConfig.socialEnabled && othersReviews.length > 0}
      <div class="flex flex-wrap gap-1.5">
        {#each ARRANGEMENTS as option (option.value)}
          <button
            type="button"
            class="chip"
            class:chip-on={arrangement === option.value}
            aria-pressed={arrangement === option.value}
            onclick={() => (arrangement = option.value)}>
            {option.label()}
          </button>
        {/each}
      </div>
    {/if}

    {#if myReview && (showMineInList || !appConfig.socialEnabled)}
      <ReviewCard review={myReview} mine onEdit={() => (editing = true)} />
    {/if}

    {#if appConfig.socialEnabled}
      {#if communityLoaded && othersReviews.length === 0}
        <p class="text-dim text-sm">
          {m.reviews_section_empty_community()}
        </p>
      {:else if arrangement === "friends" && shownOthers.length === 0}
        <p class="text-dim text-sm">{m.reviews_filter_friends_empty()}</p>
      {:else}
        {#each shownOthers as review (review.id)}
          <ReviewCard
            {review}
            voting={isVoting(review.id)}
            onVote={(value) => voteMut.mutate({ review, value })}
            onReport={() => (reportingId = review.id)} />
        {/each}
      {/if}
    {/if}
  </div>
</section>

{#if editing}
  <ReviewFormModal
    title={workTitle}
    meta={workMeta}
    imageUrl={workImageUrl}
    {targetType}
    {targetId}
    review={myReview}
    defaultVisibility={auth.user?.defaultReviewVisibility ?? "FRIENDS"}
    onClose={() => (editing = false)}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}

{#if reportingId}
  <ReportModal
    title={m.reviews_report_title()}
    onClose={() => (reportingId = null)}
    onSubmit={submitReport} />
{/if}

<style>
  .histogram-bar {
    background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
  }
</style>
