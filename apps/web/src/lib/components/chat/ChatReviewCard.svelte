<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import { ratingLabel, reviewedTitle } from "#lib/chat/attachments.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageReviewDto } from "@loomkeep/shared";
  import { fade } from "svelte/transition";

  let { review, mine }: { review: MessageReviewDto; mine: boolean } = $props();

  const reduced = prefersReducedMotion();

  let revealed = $state(false);
  const title = $derived(review.target ? reviewedTitle(review.target) : "");
  // A season's or an episode's review lives in its episode list, not among
  // the work's: only a work's own review has a place to land on.
  const fullHref = $derived(
    review.target?.href && (review.target.seasonNumber ?? null) === null
      ? `${review.target.href}#review-${review.id}`
      : null,
  );

  function cellTone(cell: number) {
    if (cell <= review.rating) return "bg-accent";
    if (cell - 0.5 === review.rating) {
      return "bg-[linear-gradient(90deg,var(--accent)_50%,var(--surface-2)_50%)]";
    }
    return "bg-surface-2";
  }
</script>

<!-- The reviewer's words first, the rating as a gauge under them. -->
<figure
  class="border-border bg-surface text-fg flex w-72 max-w-full flex-col gap-2.5 rounded-2xl border p-3.5">
  {#if review.spoiler && !revealed}
    <button
      type="button"
      class="text-fg flex items-center gap-2 rounded-xl bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent)_0_8px,var(--surface-2)_8px_16px)] px-3.5 py-3 text-left text-sm font-bold transition-[filter] duration-150 hover:brightness-110"
      onclick={() => (revealed = true)}>
      <Icon name="eye-off" class="h-4 w-4 shrink-0" />
      {m.chat_review_spoiler()}
    </button>
  {:else if review.text}
    <blockquote
      in:fade={{ duration: reduced ? 0 : 150 }}
      class="font-display line-clamp-6 text-[1.02rem] leading-snug font-semibold whitespace-pre-line">
      <span class="text-accent">{m.chat_review_quote_open()}</span
      >{review.text}<span class="text-accent"
        >{m.chat_review_quote_close()}</span>
    </blockquote>
  {/if}

  <span
    class="grid grid-cols-10 gap-[3px]"
    role="img"
    aria-label={m.chat_review_rating({ rating: ratingLabel(review.rating) })}>
    {#each Array.from({ length: 10 }, (_, i) => i + 1) as cell (cell)}
      <i class="h-[7px] rounded-[2px] {cellTone(cell)}"></i>
    {/each}
  </span>

  <figcaption class="flex flex-col gap-2">
    <span class="text-dim flex items-center gap-2 text-[0.82rem]">
      {#if review.target}
        <span
          class="aspect-square w-[22px] shrink-0 overflow-hidden rounded-full">
          <Poster
            src={review.target.imageUrl}
            title={review.target.title}
            alt=""
            caption={false} />
        </span>
      {/if}
      <span class="min-w-0 truncate">
        {#if review.target?.href}
          <a
            href={review.target.href}
            class="text-fg hover:text-accent font-semibold no-underline transition-colors duration-150"
            onclick={() => chat.close()}>{title}</a>
        {:else}
          <b class="text-fg font-semibold">{title}</b>
        {/if}
        · {mine ? m.chat_review_mine() : m.chat_review_theirs()}
      </span>
      <span class="text-accent ml-auto shrink-0 font-mono text-base font-bold">
        {ratingLabel(review.rating)}
      </span>
    </span>
    {#if fullHref}
      <a
        href={fullHref}
        class="text-accent group -mt-0.5 flex items-center gap-1 self-start text-xs font-semibold no-underline"
        onclick={() => chat.close()}>
        {m.chat_review_read_full()}
        <Icon
          name="arrow-right"
          class="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </a>
    {/if}
  </figcaption>
</figure>
