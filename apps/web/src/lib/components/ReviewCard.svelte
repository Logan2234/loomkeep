<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { ratingWord } from "$lib/rating-words";
  import {
    levelProgress,
    SpoilerSensitivity,
    type ReviewDto,
    type ReviewVoteValue,
  } from "@loomkeep/shared";
  import { tick } from "svelte";
  import Avatar from "./Avatar.svelte";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import RelativeTime from "./RelativeTime.svelte";
  import RollingNumber from "./RollingNumber.svelte";

  // One review on a work's detail page. The viewer's own review swaps the
  // author footer for its audience + an edit action; everyone else's gets
  // votes and the report menu. Replies are deliberately absent — a review is
  // a verdict, not a conversation (comments cover that).
  let {
    review,
    mine = false,
    voting = false,
    votesLocked = false,
    onEdit,
    onVote,
    onReport,
  }: {
    review: ReviewDto;
    mine?: boolean;
    /** This card's vote is the one in flight. */
    voting?: boolean;
    /** Another card's vote is in flight — votes go one at a time. */
    votesLocked?: boolean;
    onEdit?: () => void;
    onVote?: (value: ReviewVoteValue) => void;
    onReport?: () => void;
  } = $props();

  const RESIZE_MS = 260;
  const RESIZE_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  const reduced = prefersReducedMotion();

  let expanded = $state(false);
  let overflowing = $state(false);
  let resizing = $state(false);
  // The viewer wrote it, so there's nothing to hide from them. AUTO and
  // ALWAYS_HIDDEN read the same here — reviews have no per-item "already
  // finished this" signal the way episodes/seasons do (see CommentsPanel's
  // revealSpoilersByDefault), so only an explicit ALWAYS_REVEALED changes
  // anything.
  let revealed = $state(false);
  const spoilerApplies = $derived(
    review.spoilerTag &&
      !mine &&
      auth.user?.spoilerSensitivity !== SpoilerSensitivity.ALWAYS_REVEALED,
  );
  const masked = $derived(spoilerApplies && !revealed);

  let textEl = $state<HTMLParagraphElement>();

  $effect(() => {
    void review.text;
    if (!textEl || expanded) return;
    overflowing = textEl.scrollHeight > textEl.clientHeight + 1;
  });

  // line-clamp can't be transitioned, so the height is animated explicitly
  // between the clamped and full measurements. The clamp (and its ellipsis)
  // only comes back once the collapse has finished.
  async function toggleExpanded() {
    if (!textEl || resizing) return;

    if (reduced) {
      expanded = !expanded;
      return;
    }

    const from = textEl.offsetHeight;
    resizing = true;

    if (expanded) {
      const to = clampedHeight(textEl);
      const collapse = textEl.animate(
        [{ height: `${from}px` }, { height: `${to}px` }],
        { duration: RESIZE_MS, easing: RESIZE_EASING, fill: "forwards" },
      );
      await collapse.finished;
      expanded = false;
      await tick();
      collapse.cancel();
    } else {
      expanded = true;
      await tick();
      const to = textEl.scrollHeight;
      await textEl.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: RESIZE_MS,
        easing: RESIZE_EASING,
      }).finished;
    }

    resizing = false;
  }

  function clampedHeight(el: HTMLElement): number {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(lineHeight * 2);
  }

  const xp = $derived(review.author?.xp);
  const level = $derived(
    xp === undefined || xp === null ? null : levelProgress(xp).level,
  );
</script>

<article
  class="card flex flex-col gap-2 px-3.5 py-3"
  class:border-accent-mix={mine}>
  <div class="flex items-center gap-2">
    <span
      class="bg-accent text-accent-fg rounded-[5px] px-[7px] py-px font-mono text-[0.8rem] font-bold tabular-nums">
      {review.rating}
    </span>
    <span class="text-[0.85rem] font-semibold"
      >{ratingWord(review.rating)}</span>
    {#if mine}
      <span
        class="text-accent ml-1 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
        {m.reviews_you()}
      </span>
    {/if}
    {#if review.spoilerTag && mine}
      <span
        class="border-border text-dim rounded border px-1.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase">
        {m.reviews_spoiler_tag()}
      </span>
    {/if}
    <RelativeTime
      iso={review.updatedAt}
      class="timecode ml-auto shrink-0 text-[0.68rem]" />
  </div>

  {#if review.text}
    <div class="relative overflow-hidden rounded-lg">
      <p
        bind:this={textEl}
        class="spoiler-text overflow-hidden text-sm leading-relaxed wrap-break-word"
        class:line-clamp-2={!expanded}
        class:masked
        aria-hidden={masked}>
        {review.text}
      </p>
      {#if spoilerApplies}
        <button
          type="button"
          class="veil group"
          class:gone={!masked}
          tabindex={masked ? 0 : -1}
          aria-hidden={!masked}
          onclick={() => (revealed = true)}>
          <span
            class="border-border bg-surface text-dim group-hover:border-accent group-hover:text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition-[color,border-color,transform] group-hover:scale-[1.04] group-active:scale-[0.97]">
            <Icon name="eye" class="h-3.5 w-3.5" />
            {m.reviews_reveal_spoiler()}
          </span>
        </button>
      {/if}
    </div>
  {/if}

  {#if !mine}
    <hr class="border-border my-0.5" />
  {/if}

  <div class="flex items-center gap-1">
    {#if mine}
      {#if appConfig.socialEnabled}
        <span class="timecode flex items-center gap-1.5 text-[0.7rem]">
          <Icon
            name={review.visibility === "PUBLIC" ? "globe" : "users"}
            class="h-3.5 w-3.5" />
          {review.visibility === "PUBLIC"
            ? m.common_public()
            : m.common_friends()}
          {#if review.voteScore !== 0}
            <span aria-hidden="true">·</span>
            <span aria-label={m.reviews_section_vote_score_label()}
              >{review.voteScore > 0
                ? `+${review.voteScore}`
                : review.voteScore}</span>
          {/if}
        </span>
      {/if}
    {:else}
      <div class="flex min-w-0 items-center gap-2 text-[0.78rem]">
        {#if !review.author}
          <Avatar seed="utilisateur-supprime" size={20} />
          <span class="text-dim truncate italic"
            >{m.common_deleted_user()}</span>
        {:else if review.author.anonymized}
          <!-- Seeded on the derived pseudonym, never the real id — a stable
             seed would let the same identicon resurface across unrelated
             works and quietly de-anonymize the author. -->
          <Avatar seed={review.author.displayName} size={20} />
          <span class="timecode truncate font-semibold">
            {review.author.displayName}
          </span>
        {:else}
          <a
            href="/app/u/{review.author.username}"
            class="group flex min-w-0 items-center gap-2">
            <Avatar
              seed={review.author.username}
              url={review.author.avatarUrl}
              size={20} />
            <span
              class="truncate font-semibold underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current">
              {review.author.displayName}
            </span>
          </a>
          {#if appConfig.gamificationEnabled && level !== null}
            <span
              class="border-border text-dim shrink-0 rounded border px-[5px] font-mono text-[0.62rem] font-bold"
              title={m.profile_level_full({ level })}>
              {level}
            </span>
          {/if}
        {/if}
      </div>
    {/if}

    <span class="flex-1"></span>

    {#if overflowing || expanded}
      <button
        type="button"
        class="text-accent shrink-0 px-1 text-[0.82rem] font-semibold"
        aria-expanded={expanded}
        onclick={toggleExpanded}>
        {expanded ? m.reviews_read_less() : m.reviews_read_more()}
      </button>
    {/if}

    {#if mine}
      {#if onEdit}
        <button type="button" class="btn-text shrink-0" onclick={onEdit}>
          <Icon name="edit" class="h-4 w-4" />
          {m.common_edit()}
        </button>
      {/if}
    {:else}
      {#if onVote}
        <div
          class="border-border ml-1 inline-flex shrink-0 items-center rounded-full border">
          <button
            type="button"
            class="hover:text-accent hover:bg-surface-2 grid rounded-full px-2 py-1 transition-colors active:scale-90 disabled:pointer-events-none"
            class:opacity-40={voting}
            class:text-accent={review.myVote === "UP"}
            class:text-dim={review.myVote !== "UP"}
            aria-label={m.reviews_section_vote_up()}
            title={m.reviews_section_vote_up()}
            aria-pressed={review.myVote === "UP"}
            disabled={voting || votesLocked}
            onclick={() => onVote("UP")}>
            <Icon name="chevron-up" class="h-4 w-4" />
          </button>
          <span
            class="min-w-[2ch] text-center font-mono text-[0.78rem] font-bold tabular-nums"
            aria-label={m.reviews_section_vote_score_label()}>
            <RollingNumber value={review.voteScore} />
          </span>
          <button
            type="button"
            class="hover:text-accent hover:bg-surface-2 grid rounded-full px-2 py-1 transition-colors active:scale-90 disabled:pointer-events-none"
            class:opacity-40={voting}
            class:text-accent={review.myVote === "DOWN"}
            class:text-dim={review.myVote !== "DOWN"}
            aria-label={m.reviews_section_vote_down()}
            title={m.reviews_section_vote_down()}
            aria-pressed={review.myVote === "DOWN"}
            disabled={voting || votesLocked}
            onclick={() => onVote("DOWN")}>
            <Icon name="chevron-down" class="h-4 w-4" />
          </button>
        </div>
      {/if}
      {#if onReport}
        <Dropdown placement="bottom-end" class="min-w-40">
          {#snippet trigger({ open, toggle })}
            <button
              type="button"
              class="btn-icon"
              aria-label={m.common_more_actions()}
              aria-haspopup="menu"
              aria-expanded={open}
              onclick={toggle}>
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            <button
              role="menuitem"
              class="menu-item menu-item-danger"
              onclick={() => {
                close();
                onReport();
              }}>
              <Icon name="flag" class="h-4 w-4" />
              {m.common_report()}
            </button>
          {/snippet}
        </Dropdown>
      {/if}
    {/if}
  </div>
</article>

<style>
  .border-accent-mix {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }

  /* The reveal eases the blur out rather than snapping it off, so the text
     "comes into focus" — the one deliberate motion in the card. */
  .spoiler-text {
    transition: filter 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .spoiler-text.masked {
    filter: blur(6px);
    user-select: none;
  }

  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    width: 100%;
    cursor: pointer;
    background: color-mix(in srgb, var(--surface) 35%, transparent);
    transition:
      opacity 0.25s ease-out,
      background-color 0.2s,
      visibility 0s linear 0s;
  }

  .veil:hover {
    background: color-mix(in srgb, var(--surface) 15%, transparent);
  }

  .veil.gone {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.25s ease-out,
      visibility 0s linear 0.25s;
  }
</style>
