<script lang="ts">
  import {
    getMyReview,
    getReviewsForTarget,
    unvoteReview,
    voteReview,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    ReviewDto,
    ReviewTargetType,
    ReviewVoteValue,
  } from "@loomkeep/shared";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import ReviewFormModal from "./ReviewFormModal.svelte";
  import StreakBadge from "./StreakBadge.svelte";

  // Always-visible review section for a work's detail page: the viewer's own
  // review (add/edit via the shared modal) + everyone else's, visibility-
  // filtered server-side. Anchored at the very bottom of the page — or, for a
  // season/episode target, embedded directly inside a Modal (EpisodesSection),
  // in which case `compact` drops the top margin the Modal's own heading
  // already accounts for.
  let {
    targetType,
    targetId,
    workTitle,
    compact = false,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
    workTitle: string;
    compact?: boolean;
  } = $props();

  let myReview = $state<ReviewDto | null>(null);
  let myReviewLoaded = $state(false);
  let allReviews = $state<ReviewDto[]>([]);
  let communityLoaded = $state(false);
  let editing = $state(false);

  // `listForTarget` always includes the viewer's own review — keep the
  // community list to everyone else so it isn't shown twice.
  const othersReviews = $derived(
    allReviews.filter((r) => r.author?.id !== auth.user?.id),
  );

  $effect(() => {
    const type = targetType;
    const id = targetId;
    myReviewLoaded = false;
    void getMyReview(type, id)
      .then((r) => (myReview = r))
      .finally(() => (myReviewLoaded = true));
  });

  $effect(() => {
    const type = targetType;
    const id = targetId;
    if (!appConfig.socialEnabled) return;
    communityLoaded = false;
    void getReviewsForTarget(type, id)
      .then((r) => (allReviews = r))
      .catch(() => (allReviews = []))
      .finally(() => (communityLoaded = true));
  });

  function handleSaved(updated: ReviewDto) {
    myReview = updated;
  }

  function handleDeleted() {
    myReview = null;
  }

  // Reddit-style: clicking the already-active direction removes the vote,
  // clicking the other one replaces it. One in-flight vote at a time.
  let votingId = $state<string | null>(null);

  function applyVote(
    id: string,
    score: number,
    myVote: ReviewVoteValue | null,
  ) {
    allReviews = allReviews.map((r) =>
      r.id === id ? { ...r, voteScore: score, myVote } : r,
    );
  }

  async function castVote(review: ReviewDto, value: ReviewVoteValue) {
    if (votingId) return;
    votingId = review.id;
    try {
      if (review.myVote === value) {
        const { score } = await unvoteReview(review.id);
        applyVote(review.id, score, null);
      } else {
        const { score, myVote } = await voteReview(review.id, value);
        applyVote(review.id, score, myVote);
      }
    } finally {
      votingId = null;
    }
  }
</script>

<section class={compact ? "" : "mt-6"}>
  <div class="mb-3 flex items-center justify-between gap-2">
    <h2 class="font-display mb-3 text-xl font-bold">
      {#if appConfig.socialEnabled}
        {m.reviews_section_community_title({ count: othersReviews.length })}
      {:else}
        {m.reviews_section_my_review_title()}
      {/if}
    </h2>
    {#if myReviewLoaded}
      <button
        class="btn btn-ghost btn-sm shrink-0"
        onclick={() => (editing = true)}>
        {myReview ? m.common_edit() : m.common_add()}
      </button>
    {/if}
  </div>

  {#if myReview}
    <div class="card mb-3 p-3">
      <div class="flex items-center gap-3">
        {#if auth.user}
          <Avatar
            seed={auth.user.username}
            url={auth.user.avatarUrl}
            size={32} />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">
            {m.reviews_section_your_review()}
          </p>
          {#if appConfig.socialEnabled}
            <p class="timecode flex items-center gap-2 text-xs">
              <span
                >{myReview.visibility === "PUBLIC"
                  ? m.profile_reviews_public()
                  : m.profile_reviews_friends()}</span>
              {#if myReview.voteScore !== 0}
                <span aria-label={m.reviews_section_vote_score_label()}
                  >{myReview.voteScore > 0
                    ? `+${myReview.voteScore}`
                    : myReview.voteScore}</span>
              {/if}
            </p>
          {/if}
        </div>
        <span
          class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
          {myReview.rating}<span class="text-accent/60 text-xs">/10</span>
        </span>
      </div>
      {#if myReview.text}
        <p class="mt-2 text-sm leading-relaxed wrap-break-word">
          {myReview.text}
        </p>
      {/if}
    </div>
  {/if}

  {#if appConfig.socialEnabled}
    {#if communityLoaded && othersReviews.length === 0}
      <p class="text-dim text-sm">
        {m.reviews_section_empty_community()}
      </p>
    {:else if othersReviews.length > 0}
      <ul class="flex flex-col gap-2">
        {#each othersReviews as review (review.id)}
          <li class="card p-3">
            <div class="flex items-center gap-3">
              <div class="flex shrink-0 flex-col items-center gap-0.5">
                <button
                  type="button"
                  class="hover:text-accent disabled:opacity-40 {review.myVote ===
                  'UP'
                    ? 'text-accent'
                    : 'text-dim'}"
                  aria-label={m.reviews_section_vote_up()}
                  title={m.reviews_section_vote_up()}
                  aria-pressed={review.myVote === "UP"}
                  disabled={votingId === review.id}
                  onclick={() => castVote(review, "UP")}>
                  <Icon name="chevron-up" class="h-4 w-4" />
                </button>
                <span class="timecode text-xs font-semibold">
                  {review.voteScore}
                </span>
                <button
                  type="button"
                  class="hover:text-accent disabled:opacity-40 {review.myVote ===
                  'DOWN'
                    ? 'text-accent'
                    : 'text-dim'}"
                  aria-label={m.reviews_section_vote_down()}
                  title={m.reviews_section_vote_down()}
                  aria-pressed={review.myVote === "DOWN"}
                  disabled={votingId === review.id}
                  onclick={() => castVote(review, "DOWN")}>
                  <Icon name="chevron-down" class="h-4 w-4" />
                </button>
              </div>
              <div class="flex min-w-0 flex-1 gap-2">
                {#if !review.author}
                  <span class="shrink-0">
                    <Avatar seed="utilisateur-supprime" size={32} />
                  </span>
                  <p class="text-dim truncate text-sm font-semibold italic">
                    Utilisateur supprimé
                  </p>
                {:else if review.author.anonymized}
                  <!-- Seeded on the derived pseudonym, never the real id — a
                     stable seed would let the same identicon resurface across
                     unrelated works and quietly de-anonymize the author. -->
                  <span class="shrink-0">
                    <Avatar seed={review.author.displayName} size={32} />
                  </span>
                  <p class="timecode truncate text-sm font-semibold">
                    {review.author.displayName}
                  </p>
                {:else}
                  <a
                    href="/app/u/{review.author.username}"
                    class="flex shrink-0 items-center">
                    <Avatar
                      seed={review.author.username}
                      url={review.author.avatarUrl}
                      size={32} />
                  </a>
                  <a href="/app/u/{review.author.username}">
                    <p
                      class="flex items-center gap-1.5 truncate text-sm font-semibold hover:underline">
                      {review.author.displayName}
                      <StreakBadge days={review.author.streakDays} />
                    </p>
                    <p class="timecode truncate text-xs">
                      @{review.author.username}
                    </p>
                  </a>
                {/if}
              </div>
              <span
                class="bg-accent/15 text-accent shrink-0 rounded-md px-2.5 py-1 font-mono font-bold tabular-nums">
                {review.rating}<span class="text-accent/60 text-xs">/10</span>
              </span>
            </div>
            {#if review.text}
              <p class="mt-2 text-sm leading-relaxed wrap-break-word">
                {review.text}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

{#if editing}
  <ReviewFormModal
    title={workTitle}
    {targetType}
    {targetId}
    review={myReview}
    defaultVisibility={auth.user?.defaultReviewVisibility ?? "FRIENDS"}
    onClose={() => (editing = false)}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}
