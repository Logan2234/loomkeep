<script lang="ts">
  import ClampedText from "#lib/components/ClampedText.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailSeasonDto } from "@loomkeep/shared";
  import { fly } from "svelte/transition";
  import { airDateLabel, scoreLabel } from "./episode-format";

  const reduced = prefersReducedMotion();

  let {
    season,
    title,
    tracked,
    exactTime,
    canOpenPosters,
    watchedCount,
    hasPending,
    finished,
    allWatched,
    marking,
    onPosters,
    onReview,
    onMark,
    onUndo,
  }: {
    season: MediaDetailSeasonDto;
    title: string;
    tracked: boolean;
    exactTime: boolean;
    /** TMDB only: its poster opens the season's gallery. */
    canOpenPosters: boolean;
    watchedCount: number;
    /** Aired episodes are left to mark. */
    hasPending: boolean;
    /** Just crossed into fully watched. */
    finished: boolean;
    allWatched: boolean;
    marking: boolean;
    onPosters: () => void;
    onReview: () => void;
    onMark: () => void;
    onUndo: () => void;
  } = $props();
</script>

<section
  class="border-border bg-surface grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border p-3 sm:grid-cols-[5.75rem_minmax(0,1fr)] sm:p-4">
  <h3 class="col-span-2 flex items-baseline justify-between gap-3">
    <span class="font-display min-w-0 truncate font-bold">{title}</span>
    <span class="timecode text-dim shrink-0 text-xs">
      {tracked
        ? m.media_watched_of({
            watched: watchedCount,
            total: season.episodes.length,
          })
        : m.media_season_episode_count({ count: season.episodes.length })}
    </span>
  </h3>

  {#if season.posterUrl && canOpenPosters}
    <button
      type="button"
      class="group row-span-2 self-start overflow-hidden rounded-lg sm:row-span-3"
      aria-label={m.media_season_images()}
      onclick={onPosters}>
      <img
        src={season.posterUrl}
        alt=""
        class="w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transition-none" />
    </button>
  {:else if season.posterUrl}
    <img
      src={season.posterUrl}
      alt=""
      class="row-span-2 w-full self-start rounded-lg object-cover sm:row-span-3" />
  {:else}
    <span
      class="bg-surface-2 row-span-2 aspect-[2/3] w-full rounded-lg sm:row-span-3"
    ></span>
  {/if}
  <div class="min-w-0">
    <p class="timecode text-dim text-[0.68rem] uppercase">
      {exactTime ? m.media_anime_synopsis() : m.media_season_synopsis()}
    </p>
    <p
      class="timecode text-dim mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem]">
      {#if season.airDate}
        <span>
          {m.media_season_premiere({
            date: airDateLabel(season.airDate, false, true),
          })}
        </span>
      {/if}
      <span
        >{m.media_season_episode_count({
          count: season.episodes.length,
        })}</span>
      {#if season.voteAverage !== null}
        <span
          >{m.media_score_tmdb({
            score: scoreLabel(season.voteAverage),
          })}</span>
      {/if}
      {#if season.reviewAverage !== null}
        <span
          >{m.media_score_loomkeep({
            score: scoreLabel(season.reviewAverage),
          })}</span>
      {/if}
    </p>
  </div>

  {#if season.overview}
    <div class="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
      {#key season.number}
        <ClampedText
          text={season.overview}
          lines={3}
          class="text-sm leading-relaxed" />
      {/key}
    </div>
  {/if}

  <div
    class="col-span-2 flex flex-wrap items-center gap-1 sm:col-span-1 sm:col-start-2">
    {#if tracked && season.id}
      <button
        type="button"
        class="hover:bg-surface-2 inline-flex h-7 items-center gap-1 rounded-full px-1.5 text-xs transition-colors active:scale-95 motion-reduce:transition-none
          {season.myRating !== null ? 'text-accent' : 'text-dim hover:text-fg'}"
        aria-label={m.media_season_review()}
        title={m.media_season_review()}
        onclick={onReview}>
        <Icon name="star" class="h-3.5 w-3.5" />
        {#if season.reviewCount !== null}
          <span class="timecode leading-none tabular-nums"
            >{season.reviewCount}</span>
        {:else if season.myRating !== null}
          <span class="timecode leading-none tabular-nums"
            >{scoreLabel(season.myRating)}</span>
        {/if}
      </button>
    {/if}
    {#if appConfig.socialEnabled && season.id}
      <CommentsPanel
        targetType="SEASON"
        targetId={season.id}
        {title}
        canParticipate={tracked}
        revealSpoilersByDefault={allWatched}
        compact />
    {/if}
    {#if finished}
      <!-- Said in words, once, where the click happened — finishing a
           season often unlocks an achievement too, and one gesture must
           not produce two notifications competing at the top. -->
      <p
        class="text-accent flex items-center gap-1.5 text-xs font-bold"
        transition:fly|global={{
          y: reduced ? 0 : -6,
          duration: reduced ? 0 : 220,
        }}>
        <Icon name="trophy" class="h-3.5 w-3.5" />
        {m.media_season_finished()}
      </p>
    {/if}
    {#if tracked && season.id}
      {#if hasPending}
        <button
          type="button"
          class="btn btn-ghost btn-sm ml-auto"
          disabled={marking}
          onclick={onMark}>
          <Icon name="check" class="h-4 w-4" />
          {m.media_mark_aired_watched()}
        </button>
      {:else if watchedCount > 0}
        <button
          type="button"
          class="btn btn-ghost btn-sm hover:text-danger ml-auto"
          onclick={onUndo}>
          {m.media_undo_season()}
        </button>
      {/if}
    {/if}
  </div>
</section>
