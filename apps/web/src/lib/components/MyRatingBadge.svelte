<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { createMyReview } from "$lib/my-review.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ReviewTargetType } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";
  import ReviewFormModal from "./ReviewFormModal.svelte";

  // The viewer's rating in a detail page's hero, opening the review modal in
  // place — rating a work shouldn't require scrolling to the reviews section.
  let {
    targetType,
    targetId,
    workTitle,
    workMeta,
    workImageUrl,
    overlay = false,
  }: {
    targetType: ReviewTargetType;
    targetId: string;
    workTitle: string;
    workMeta?: string;
    workImageUrl?: string | null;
    /** Sits on a backdrop image (media hero) rather than the page surface. */
    overlay?: boolean;
  } = $props();

  const mine = createMyReview(() => ({ targetType, targetId }));
  const myReview = $derived(mine.review);

  let editing = $state(false);
</script>

{#if mine.loaded}
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold transition-[filter,transform] hover:brightness-110 active:scale-[0.97] {overlay
      ? 'bg-white/15 text-white backdrop-blur'
      : 'bg-accent/15 text-accent'}"
    onclick={() => (editing = true)}>
    <Icon name="star" class="h-3.5 w-3.5" />
    {#if myReview}
      <span>{m.reviews_my_rating()}</span>
      <span class="font-mono font-bold tabular-nums"
        >{myReview.rating}<span class="opacity-60">/10</span></span>
    {:else}
      <span>{m.reviews_rate_cta()}</span>
      <span class="font-mono opacity-60">–/10</span>
    {/if}
  </button>
{/if}

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
    onSaved={mine.set}
    onDeleted={() => mine.set(null)} />
{/if}
