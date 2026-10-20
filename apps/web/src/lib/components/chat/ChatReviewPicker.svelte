<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getMyReviews } from "#lib/api/reviews.js";
  import {
    ratingLabel,
    reviewChoices,
    reviewedTitle,
  } from "#lib/chat/attachments.js";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MyReviewDto } from "@loomkeep/shared";
  import ChatPicker from "./ChatPicker.svelte";

  let {
    query,
    onpick,
    oncancel,
  }: {
    /** What follows `/review `. */
    query: string;
    onpick: (review: MyReviewDto) => void;
    oncancel: () => void;
  } = $props();

  const reviewsQuery = createApiQuery(() => ({
    key: keys.profile.myReviews(),
    fetch: getMyReviews,
  }));
  const reviews = $derived(reviewChoices(reviewsQuery.data ?? [], query));

  let picker = $state<{ handleKey: (event: KeyboardEvent) => boolean } | null>(
    null,
  );

  export function handleKey(event: KeyboardEvent): boolean {
    return picker?.handleKey(event) ?? false;
  }
</script>

<ChatPicker
  bind:this={picker}
  items={reviews}
  key={(review) => review.id}
  label={m.chat_review_picker()}
  title={m.chat_review_picker()}
  empty={reviewsQuery.loading ? m.common_loading() : m.chat_review_empty()}
  {onpick}
  {oncancel}>
  {#snippet row(review)}
    <span class="w-[26px] shrink-0 overflow-hidden rounded">
      <Poster
        src={review.target.imageUrl}
        title={review.target.title}
        alt=""
        caption={false} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-1.5">
        <span class="truncate text-sm font-semibold"
          >{reviewedTitle(review.target)}</span>
        {#if review.spoilerTag}
          <span
            class="border-accent text-accent shrink-0 rounded-full border px-1.5 font-mono text-[0.6rem] font-bold tracking-wider uppercase">
            {m.reviews_spoiler_tag()}
          </span>
        {/if}
      </span>
      <span class="text-dim block truncate text-xs">
        {review.text ?? m.chat_review_rating_only()}
      </span>
    </span>
    <span class="text-accent shrink-0 font-mono text-sm font-bold">
      {ratingLabel(review.rating)}/10
    </span>
  {/snippet}
</ChatPicker>
