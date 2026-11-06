<script lang="ts">
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import {
    DATE_MEDIUM_OPTIONS,
    formatDate,
    formatRuntimeTimecode,
  } from "#lib/format.js";
  import { layout } from "#lib/layout.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailEpisodeDto } from "@loomkeep/shared";
  import { airDateLabel, scoreLabel, upcomingLabel } from "./episode-format";
  import { isAired } from "./episodes";

  let {
    episode,
    seasonNumber,
    code,
    exactTime,
    tracked,
    now,
    selected = false,
    highlighted = false,
    justWatched = false,
    busy = false,
    isNext = false,
    selecting = false,
    checked = false,
    onOpen,
    onMark,
    onRewatch,
    onUndo,
    onUndoAll,
    onToggle,
  }: {
    episode: MediaDetailEpisodeDto;
    seasonNumber: number;
    /** "S02E05". */
    code: string;
    /** Anime: the air date carries a broadcast time. */
    exactTime: boolean;
    /** In the viewer's library — tracking actions show. */
    tracked: boolean;
    now: Date;
    /** Its details are open. */
    selected?: boolean;
    /** Reached through a link or a jump, lit for a moment. */
    highlighted?: boolean;
    /** Just marked: the tick pops. */
    justWatched?: boolean;
    busy?: boolean;
    /** The next episode to watch: its circle stands out. */
    isNext?: boolean;
    /** The list is in selection mode. */
    selecting?: boolean;
    /** Part of the selection. */
    checked?: boolean;
    onOpen: () => void;
    onMark: () => void;
    onRewatch: () => void;
    onUndo: () => void;
    onUndoAll: () => void;
    onToggle: (shiftKey: boolean) => void;
  } = $props();

  const title = $derived(
    episode.title ?? `${m.common_episode()} ${episode.number}`,
  );
  const watched = $derived(episode.watchCount > 0);
  const upcoming = $derived(
    watched ? null : upcomingLabel(episode.airDate, now, exactTime),
  );
  const selectable = $derived(tracked && !!episode.id && isAired(episode, now));
  // With social features off, reviews are private: the count would always be
  // the viewer's own one, so their score shows instead.
  const reviewBadge = $derived(
    episode.reviewCount !== null
      ? String(episode.reviewCount)
      : episode.myRating !== null
        ? scoreLabel(episode.myRating)
        : null,
  );
  const lastWatchedAt = $derived(
    episode.watches[0]?.watchedAt
      ? formatDate(episode.watches[0].watchedAt, DATE_MEDIUM_OPTIONS)
      : null,
  );
</script>

{#snippet checkbox(onImage: boolean)}
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={m.media_select_episode({ code })}
    disabled={!selectable}
    class="relative z-10 grid shrink-0 place-items-center rounded-md border-2 transition-[background-color,border-color,opacity] duration-150 after:absolute after:-inset-2.5 disabled:border-dashed disabled:opacity-40
      {onImage ? 'h-6 w-6' : 'h-7 w-7'}
      {checked
      ? 'bg-accent border-accent text-bg'
      : onImage
        ? 'bg-bg/80 border-fg/70'
        : 'border-dim'}"
    onclick={(e) => onToggle(e.shiftKey)}>
    {#if checked}<Icon
        name="check"
        class={onImage ? "h-3.5 w-3.5" : "h-4 w-4"} />{/if}
  </button>
{/snippet}

<li
  id="episode-s{seasonNumber}e{episode.number}"
  data-episode-row={selectable ? episode.id : undefined}
  class="group/row border-border relative border-t transition-colors duration-500 first:border-t-0
    {justWatched ? 'episode-reward-flash' : ''}
    {checked
    ? 'bg-accent/12'
    : highlighted
      ? 'bg-accent/15'
      : selected
        ? 'bg-surface-2'
        : 'hover:bg-surface-2/50'}">
  <div
    class="grid grid-cols-[7rem_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 sm:gap-x-4 sm:px-4">
    <div
      class="bg-surface-2 relative aspect-video w-full self-start overflow-hidden rounded-lg">
      {#if episode.stillUrl}
        <img
          src={episode.stillUrl}
          alt=""
          loading="lazy"
          class="h-full w-full object-cover" />
      {:else}
        <span class="text-dim/60 absolute inset-0 grid place-items-center">
          <Icon name="tv" class="h-6 w-6" />
        </span>
      {/if}
      {#if watched}
        <span
          class="bg-success text-bg absolute right-1.5 bottom-1.5 grid h-5 w-5 place-items-center rounded-full
            {justWatched ? 'episode-check-pop' : ''}">
          <Icon name="check" class="h-3.5 w-3.5" />
        </span>
      {:else if upcoming}
        <span
          class="timecode bg-bg/65 absolute inset-0 grid place-items-center text-xs text-white">
          {upcoming}
        </span>
      {/if}
      {#if !layout.compact && selectable}
        <span
          class="absolute top-1.5 left-1.5 z-10 transition-opacity duration-150 focus-within:opacity-100
            {selecting ? '' : 'opacity-0 group-hover/row:opacity-100'}">
          {@render checkbox(true)}
        </span>
      {/if}
    </div>

    <div class="min-w-0">
      <p class="flex items-baseline gap-1.5">
        <span class="timecode text-xs">{code}</span>
        {#if episode.watchCount > 1}
          <span class="timecode text-success text-xs"
            >×{episode.watchCount}</span>
        {/if}
      </p>
      <!-- Stretched over the row: touching anywhere but its actions opens it,
           or ticks it while selecting. -->
      <button
        type="button"
        class="hover:text-accent focus-visible:text-accent line-clamp-2 text-left text-[0.95rem] leading-snug font-semibold transition-colors after:absolute after:inset-0
          {episode.title ? '' : 'text-dim'}"
        aria-label={selecting ? undefined : m.media_episode_open({ code })}
        aria-hidden={selecting ? "true" : undefined}
        tabindex={selecting ? -1 : undefined}
        disabled={selecting && !selectable}
        onclick={(e) => (selecting ? onToggle(e.shiftKey) : onOpen())}>
        {title}
      </button>
      <p class="timecode text-dim mt-0.5 flex flex-wrap gap-x-2 text-[0.7rem]">
        {#if episode.airDate}
          <span>{airDateLabel(episode.airDate, exactTime)}</span>
        {/if}
        {#if episode.runtimeMin}
          <span>
            <span class="sr-only">{m.media_episode_runtime()}</span>
            {formatRuntimeTimecode(episode.runtimeMin)}
          </span>
        {/if}
      </p>
    </div>

    <!-- Above the row's stretched button; above the next rows too with its menu
         open, each column being a stacking context. -->
    <div
      data-row-actions
      class="relative z-10 mt-1 mr-1 flex w-10 flex-col items-center self-start has-[[role=menu]]:z-30">
      {#if selecting && layout.compact}
        {@render checkbox(false)}
      {:else if selecting}
        <!-- On desktop the box sits on the image; nothing else competes. -->
      {:else if tracked && episode.id}
        {#if watched}
          <Dropdown placement="bottom-end">
            {#snippet trigger({ toggle, onkeydown, open })}
              <button
                type="button"
                class="text-success relative flex flex-col items-center gap-0.5 transition-transform duration-150 after:absolute after:-inset-x-1 after:-inset-y-2 active:scale-95 motion-reduce:transition-none"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${m.media_episode_watched()} ${code}`}
                onclick={toggle}
                {onkeydown}>
                <span
                  class="bg-success text-bg relative grid h-7 w-7 place-items-center rounded-full">
                  {#if justWatched}
                    <!-- A one-off reward: a ring and a few sparks burst out of
                         the tick, then nothing stays but the tick itself. -->
                    <span class="episode-reward-ring" aria-hidden="true"></span>
                    {#each [0, 60, 120, 180, 240, 300] as angle (angle)}
                      <span
                        class="episode-reward-spark"
                        style="--angle: {angle}deg"
                        aria-hidden="true"></span>
                    {/each}
                  {/if}
                  <span class={justWatched ? "episode-check-pop" : ""}>
                    <Icon name="check" class="h-4 w-4" />
                  </span>
                </span>
                <span
                  class="text-micro inline-flex items-center font-semibold whitespace-nowrap">
                  <span class={justWatched ? "episode-reward-word" : ""}>
                    {m.media_episode_watched()}
                  </span>
                  <Icon name="chevron-down" class="h-3 w-3" />
                </span>
              </button>
            {/snippet}
            {#snippet children({ close })}
              {#if layout.compact}
                <div
                  class="border-border max-w-72 border-b px-3 py-2 [[data-menu-sheet]_&]:max-w-none [[data-menu-sheet]_&]:px-5">
                  <p class="truncate text-sm font-semibold">
                    <span class="timecode">{code}</span> · {title}
                  </p>
                  {#if lastWatchedAt}
                    <p class="text-dim mt-0.5 text-xs">
                      {episode.watchCount > 1
                        ? m.media_watched_on_count({
                            date: lastWatchedAt,
                            count: episode.watchCount,
                          })
                        : m.media_watched_on({ date: lastWatchedAt })}
                    </p>
                  {/if}
                </div>
              {/if}
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                onclick={() => {
                  close();
                  onRewatch();
                }}>
                <Icon name="refresh" class="h-4 w-4" />
                {m.media_rewatch()}
              </button>
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                onclick={() => {
                  close();
                  onUndo();
                }}>
                <Icon name="x" class="h-4 w-4" />
                {m.media_undo_watch()}
              </button>
              {#if episode.watchCount > 1}
                <button
                  type="button"
                  role="menuitem"
                  class="menu-item menu-item-danger"
                  onclick={() => {
                    close();
                    onUndoAll();
                  }}>
                  <Icon name="trash" class="h-4 w-4" />
                  {m.media_undo_all_watches({ count: episode.watchCount })}
                </button>
              {/if}
            {/snippet}
          </Dropdown>
        {:else if upcoming}
          <span
            class="timecode border-border text-dim rounded-md border px-1 py-0.5 text-center text-[0.6rem] leading-tight"
            title={m.media_not_aired()}>
            {upcoming}
          </span>
        {:else if isAired(episode, now)}
          <button
            type="button"
            class="relative h-7 w-7 rounded-full transition-[background-color,transform] duration-150 after:absolute after:-inset-2.5 active:scale-90 motion-reduce:transition-none
              {isNext
              ? 'border-accent hover:bg-accent/15 border-[3px]'
              : 'border-dim hover:bg-surface-2 border-2'}"
            disabled={busy}
            aria-label={m.media_mark_watched_code({ code })}
            title={m.media_mark_watched_short()}
            onclick={onMark}></button>
        {/if}
      {/if}
    </div>

    <div class="col-span-3 min-w-0">
      {#if episode.overview}
        <p class="text-dim line-clamp-2 text-sm leading-relaxed">
          {episode.overview}
        </p>
      {/if}
      <p
        class="timecode text-dim mt-1 flex items-center gap-x-1.5 overflow-hidden text-[0.7rem] whitespace-nowrap empty:hidden [&>*:not(:first-child)]:before:mr-1.5 [&>*:not(:first-child)]:before:content-['·']">
        {#if episode.voteAverage !== null}
          <span
            >{m.media_score_tmdb({
              score: scoreLabel(episode.voteAverage),
            })}</span>
        {/if}
        {#if episode.reviewAverage !== null}
          <span
            >{m.media_score_loomkeep({
              score: scoreLabel(episode.reviewAverage),
            })}</span>
        {/if}
        {#if tracked && episode.id && reviewBadge}
          <span
            class="inline-flex items-center gap-0.5 {episode.myRating !== null
              ? 'text-accent'
              : ''}">
            <Icon name="star" class="h-3 w-3" />{reviewBadge}
          </span>
        {/if}
        {#if appConfig.socialEnabled && episode.id && episode.commentCount > 0}
          <span class="inline-flex items-center gap-0.5">
            <Icon name="message" class="h-3 w-3" />{episode.commentCount}
          </span>
        {/if}
        {#if watched && lastWatchedAt}
          <span class="text-success min-w-0 truncate">
            {m.media_watched_on({ date: lastWatchedAt })}
          </span>
        {/if}
      </p>
    </div>
  </div>
</li>

<style>
  /* Marking an episode is the most repeated action in the app: a small,
     quick reward (under half a second), never a celebration that would get
     tiresome. prefers-reduced-motion is handled globally in app.css. */
  .episode-reward-flash {
    animation: episode-reward-flash 480ms ease-out;
  }

  @keyframes episode-reward-flash {
    0% {
      background-color: color-mix(
        in srgb,
        var(--color-success) 14%,
        transparent
      );
    }
    100% {
      background-color: transparent;
    }
  }

  .episode-reward-ring {
    position: absolute;
    inset: -2px;
    border: 2px solid var(--color-success);
    border-radius: 9999px;
    opacity: 0;
    animation: episode-reward-ring 460ms ease-out;
  }

  @keyframes episode-reward-ring {
    0% {
      transform: scale(0.5);
      opacity: 0.9;
    }
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  .episode-reward-spark {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    margin: -2px 0 0 -2px;
    border-radius: 9999px;
    background: var(--color-accent);
    opacity: 0;
    animation: episode-reward-spark 460ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .episode-reward-spark:nth-child(odd) {
    background: var(--color-success);
  }

  @keyframes episode-reward-spark {
    0% {
      transform: rotate(var(--angle)) translateX(4px) scale(1);
      opacity: 1;
    }
    100% {
      transform: rotate(var(--angle)) translateX(16px) scale(0.4);
      opacity: 0;
    }
  }

  .episode-reward-word {
    display: inline-block;
    animation: episode-reward-word 260ms ease-out;
  }

  @keyframes episode-reward-word {
    0% {
      transform: translateX(-6px);
      opacity: 0;
    }
    100% {
      transform: none;
      opacity: 1;
    }
  }

  .episode-check-pop {
    animation: episode-check-pop 400ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @keyframes episode-check-pop {
    0% {
      transform: scale(0.45);
      opacity: 0.3;
    }
    55% {
      transform: scale(1.22);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }
</style>
