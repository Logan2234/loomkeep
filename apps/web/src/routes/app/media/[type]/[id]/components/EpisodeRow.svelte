<script lang="ts">
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import {
    DATE_MEDIUM_OPTIONS,
    formatDate,
    formatRuntimeTimecode,
  } from "#lib/format.js";
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
    onOpen,
    onMark,
    onReview,
  }: {
    episode: MediaDetailEpisodeDto;
    seasonNumber: number;
    /** "S02E05". */
    code: string;
    /** Anime: the air date carries a broadcast time. */
    exactTime: boolean;
    /** In the viewer's library — tracking and review actions show. */
    tracked: boolean;
    now: Date;
    /** Its side panel is open. */
    selected?: boolean;
    /** Reached through an `#s2e5` link, lit for a moment. */
    highlighted?: boolean;
    /** Just marked: the tick pops. */
    justWatched?: boolean;
    busy?: boolean;
    onOpen: () => void;
    onMark: () => void;
    onReview: () => void;
  } = $props();

  const title = $derived(
    episode.title ?? `${m.common_episode()} ${episode.number}`,
  );
  const watched = $derived(episode.watchCount > 0);
  const upcoming = $derived(
    watched ? null : upcomingLabel(episode.airDate, now, exactTime),
  );
  // With social features off, reviews are private: the count would always be
  // the viewer's own one, so their score shows instead.
  const reviewBadge = $derived(
    episode.reviewCount !== null
      ? String(episode.reviewCount)
      : episode.myRating !== null
        ? scoreLabel(episode.myRating)
        : null,
  );
</script>

<li
  id="episode-s{seasonNumber}e{episode.number}"
  class="border-border scroll-mt-24 border-t transition-colors duration-500 first:border-t-0
    {justWatched ? 'episode-reward-flash' : ''}
    {highlighted
    ? 'bg-accent/15'
    : selected
      ? 'bg-surface-2'
      : 'hover:bg-surface-2/50'}">
  <!-- Image + title side by side, then the synopsis and actions full width
       on a phone; a third column for the actions from `sm` up. -->
  <div
    class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:gap-y-1 sm:px-4">
    <button
      type="button"
      class="bg-surface-2 group relative aspect-video w-full self-start overflow-hidden rounded-lg sm:row-span-2"
      aria-label={m.media_episode_open({ code })}
      onclick={onOpen}>
      {#if episode.stillUrl}
        <img
          src={episode.stillUrl}
          alt=""
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transition-none" />
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
    </button>

    <div
      class="flex min-w-0 flex-wrap items-center gap-x-2 self-center sm:self-end">
      <span class="timecode shrink-0 text-xs">{code}</span>
      <button
        type="button"
        class="hover:text-accent focus-visible:text-accent min-w-0 text-left text-[0.95rem] font-semibold transition-colors
          {episode.title ? '' : 'text-dim'}"
        onclick={onOpen}>
        {title}
      </button>
      {#if episode.watchCount > 1}
        <span class="timecode text-success text-xs">×{episode.watchCount}</span>
      {/if}
    </div>

    <div class="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
      {#if episode.overview}
        <p class="text-dim line-clamp-2 text-sm leading-relaxed">
          {episode.overview}
        </p>
      {/if}
      <p
        class="timecode text-dim mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem]">
        {#if episode.airDate}
          <span>{airDateLabel(episode.airDate, exactTime)}</span>
        {/if}
        {#if episode.runtimeMin}
          <span>
            <span class="sr-only">{m.media_episode_runtime()}</span>
            {formatRuntimeTimecode(episode.runtimeMin)}
          </span>
        {/if}
        {#if episode.voteAverage !== null}
          <span
            >{m.media_score_tmdb({
              score: scoreLabel(episode.voteAverage),
            })}</span>
        {/if}
        {#if episode.reviewAverage !== null}
          <span>
            {m.media_score_loomkeep({
              score: scoreLabel(episode.reviewAverage),
            })}
          </span>
        {/if}
        {#if watched && episode.watches[0]?.watchedAt}
          <span class="text-success">
            {m.media_watched_on({
              date: formatDate(
                episode.watches[0].watchedAt,
                DATE_MEDIUM_OPTIONS,
              ),
            })}
          </span>
        {/if}
      </p>
    </div>

    <div
      class="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:flex-col sm:items-end sm:justify-between">
      <div class="flex items-center gap-0.5">
        {#if tracked && episode.id}
          <button
            type="button"
            class="hover:bg-surface-2 inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-1.5 text-xs transition-colors active:scale-95 motion-reduce:transition-none
              {episode.myRating !== null
              ? 'text-accent'
              : 'text-dim hover:text-fg'}"
            aria-label={m.media_episode_review()}
            title={m.media_episode_review()}
            onclick={onReview}>
            <Icon name="star" class="h-3.5 w-3.5" />
            {#if reviewBadge}
              <span class="timecode leading-none tabular-nums"
                >{reviewBadge}</span>
            {/if}
          </button>
        {/if}
        {#if appConfig.socialEnabled && episode.id}
          <CommentsPanel
            targetType="EPISODE"
            targetId={episode.id}
            title={`${code} · ${title}`}
            canParticipate={tracked}
            revealSpoilersByDefault={watched}
            compact />
        {/if}
      </div>

      {#if tracked && episode.id}
        {#if watched}
          <span
            class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
            <span class="relative inline-flex">
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
              <span
                class="inline-flex {justWatched ? 'episode-check-pop' : ''}">
                <Icon name="check" class="h-4 w-4" />
              </span>
            </span>
            <span class={justWatched ? "episode-reward-word" : ""}>
              {m.media_episode_watched()}
            </span>
          </span>
        {:else if upcoming}
          <span
            class="border-border text-dim shrink-0 rounded-lg border px-2.5 py-1 text-xs"
            title={m.media_not_aired()}>
            {upcoming}
          </span>
        {:else if isAired(episode, now)}
          <button
            type="button"
            class="btn btn-primary btn-sm shrink-0"
            disabled={busy}
            onclick={onMark}>
            {m.media_mark_watched_short()}
          </button>
        {/if}
      {/if}
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
