<script lang="ts">
  import { episodeCode } from "@loomkeep/shared";

  import {
    getSeasonImages,
    unwatchEpisode,
    unwatchSeason,
    watchEpisode,
    watchSeason,
    watchThrough,
  } from "#lib/api/client.js";
  import { resolveApiError } from "#lib/api/errors.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import ClampedText from "#lib/components/ClampedText.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import ReviewsSection from "#lib/components/ReviewsSection.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type {
    LibraryEntryDto,
    MediaDetailEpisodeDto,
    MediaDetailSeasonDto,
    MediaType,
    ReviewTargetType,
  } from "@loomkeep/shared";
  import { tick, untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, slide } from "svelte/transition";
  import { airDateLabel, scoreLabel } from "./episode-format";
  import EpisodePanel from "./EpisodePanel.svelte";
  import EpisodeRow from "./EpisodeRow.svelte";
  import {
    defaultSeasonNumber,
    isAired,
    largeTmdbImage,
    playlist,
    runProgress,
    unwatchedGapCount,
  } from "./episodes";

  const reduced = prefersReducedMotion();

  let {
    seasons,
    entry,
    mediaType,
    sourceId,
    reload,
    onError,
  }: {
    seasons: MediaDetailSeasonDto[];
    entry: LibraryEntryDto | null;
    mediaType: MediaType;
    /** The route's catalogue id (TMDB for a series, AniList for an anime). */
    sourceId: string;
    reload: () => Promise<void>;
    onError: (message: string) => void;
  } = $props();

  // Anime air dates are exact broadcast times (AniList's schedule).
  const exactTime = $derived(mediaType === "ANIME");
  const tmdbSourceId = $derived(mediaType === "SERIES" ? sourceId : null);

  // "Now" for aired/upcoming checks, kept current while the page stays open.
  let now = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(timer);
  });

  const markWatchedMut = createApiMutation(() => ({
    mutate: (episodeId: string) => watchEpisode(episodeId),
    onSuccess: async (_data, episodeId) => {
      await reload();
      popCheck(episodeId);
    },
    onError: (err) => onError(resolveApiError(err)),
  }));
  const markUnwatchMut = createApiMutation(() => ({
    mutate: (episodeId: string) => unwatchEpisode(episodeId),
    onSuccess: () => reload(),
    onError: (err) => onError(resolveApiError(err)),
  }));
  const confirmCatchupYesMut = createApiMutation(() => ({
    mutate: (episodeId: string) => watchThrough(episodeId),
    onSuccess: () => reload(),
    onError: (err) => onError(resolveApiError(err)),
  }));
  const markSeasonMut = createApiMutation(() => ({
    mutate: (seasonId: string) => watchSeason(seasonId),
    onSuccess: () => reload(),
    onError: (err) => onError(resolveApiError(err)),
  }));
  const confirmUnwatchSeasonMut = createApiMutation(() => ({
    mutate: (seasonId: string) => unwatchSeason(seasonId),
    onSuccess: async () => {
      await reload();
      confirmUnwatchSeasonId = null;
    },
    onError: (err) => onError(resolveApiError(err)),
  }));

  /** Whether any in-flight mutation targets this episode — drives its buttons' disabled state. */
  function episodeBusy(episodeId: string): boolean {
    return (
      (markWatchedMut.loading && markWatchedMut.variables === episodeId) ||
      (markUnwatchMut.loading && markUnwatchMut.variables === episodeId) ||
      (confirmCatchupYesMut.loading &&
        confirmCatchupYesMut.variables === episodeId)
    );
  }

  const seasonLabel = (season: MediaDetailSeasonDto) =>
    season.title ?? `${m.common_season()} ${season.number}`;
  const episodeTitle = (episode: MediaDetailEpisodeDto) =>
    episode.title ?? `${m.common_episode()} ${episode.number}`;

  // One season open at most, or none — the page stays short. On arrival:
  // the season being watched, nothing for a show not started or up to date.
  let selectedSeason = $state<number | null>(
    untrack(() => defaultSeasonNumber(seasons, new Date())),
  );
  const current = $derived(
    seasons.find((s) => s.number === selectedSeason) ?? null,
  );
  function toggleSeason(seasonNumber: number) {
    selectedSeason = selectedSeason === seasonNumber ? null : seasonNumber;
  }

  // A season's posters, in a lightbox from its own poster (TMDB only): the
  // one shown first, then the rest once fetched.
  let posterLightbox = $state<number | null>(null);
  const seasonImagesQuery = createApiQuery(() => ({
    key: keys.media.seasonImages(tmdbSourceId ?? "", posterLightbox ?? -1),
    fetch: () => getSeasonImages(tmdbSourceId!, posterLightbox!),
    enabled: !!tmdbSourceId && posterLightbox !== null,
    retry: 0,
  }));
  const posterImages = $derived.by(() => {
    const season = seasons.find((s) => s.number === posterLightbox);
    if (!season?.posterUrl) return [];
    const fileOf = (url: string) => url.slice(url.lastIndexOf("/"));
    const main = largeTmdbImage(season.posterUrl);
    const rest = (seasonImagesQuery.data?.images ?? []).filter(
      (url) => fileOf(url) !== fileOf(main),
    );
    return [main, ...rest].map((src) => ({ src, alt: seasonLabel(season) }));
  });

  // `#s2e5` (an episode code in a message links here): open the season and
  // bring the episode into view, lit for a moment.
  let highlightedEpisode = $state<string | null>(null);
  $effect(() => {
    const target = /^#s(\d+)e(\d+)$/i.exec(window.location.hash);
    if (!target) return;
    const season = Number(target[1]);
    const key = `s${season}e${Number(target[2])}`;
    untrack(() => (selectedSeason = season));
    void tick().then(() => {
      document
        .getElementById(`episode-${key}`)
        ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      highlightedEpisode = key;
      setTimeout(() => (highlightedEpisode = null), 2000);
    });
  });

  // The episode whose side panel is open.
  let openEpisode = $state<{ season: number; episode: number } | null>(null);
  const panel = $derived.by(() => {
    if (!openEpisode) return null;
    const { season: sn, episode: en } = openEpisode;
    const season = seasons.find((s) => s.number === sn);
    const episode = season?.episodes.find((e) => e.number === en);
    if (!season || !episode) return null;
    // Previous/next walk the whole run: past a season's last episode comes
    // the next season's first.
    const run = playlist(seasons, sn);
    const at = run.findIndex((p) => p.season === sn && p.episode === en);
    return { season, episode, before: run[at - 1], after: run[at + 1] };
  });

  /** Opens an episode's panel, the list following it into its season. */
  function openPanel(target: { season: number; episode: number }) {
    openEpisode = target;
    selectedSeason = target.season;
  }

  let confirmUnwatchSeasonId = $state<string | null>(null);

  // "Marquer vu" on an episode with unwatched episodes before it asks first —
  // declining once means we stop asking for the rest of this page view
  // (component instance), not persisted beyond that.
  let catchup = $state<{ episodeId: string; count: number } | null>(null);
  let declinedCatchup = $state(false);

  // A season's or episode's own review opens in a modal, never inline.
  let reviewTarget = $state<{
    type: ReviewTargetType;
    id: string;
    label: string;
  } | null>(null);

  function closeReview() {
    reviewTarget = null;
    // Its rating feeds the counts and averages shown here.
    void reload();
  }

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.watchCount > 0).length;
  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 &&
    season.episodes.every((ep) => ep.watchCount > 0);

  // Which season just crossed into "fully watched", cleared on its own. Keyed
  // by number rather than a boolean so re-finishing another season while the
  // first is still showing swaps the message instead of stacking.
  const FINISHED_MS = 2600;
  let justFinished = $state<number | null>(null);
  let watchedBefore = new Map<number, boolean>();
  $effect(() => {
    for (const season of seasons) {
      const done = seasonWatched(season);
      const was = watchedBefore.get(season.number);
      watchedBefore.set(season.number, done);
      if (was === false && done) justFinished = season.number;
    }
  });
  $effect(() => {
    if (justFinished === null) return;
    const timer = setTimeout(() => (justFinished = null), FINISHED_MS);
    return () => clearTimeout(timer);
  });

  const progress = $derived(runProgress(seasons, now));
  const progressLabel = $derived(
    progress.watched === 0
      ? m.media_episodes_not_started()
      : progress.watched >= progress.aired
        ? m.media_episodes_up_to_date()
        : m.media_episodes_progress(progress),
  );

  // Ticks land when an episode is marked — gated on "the episode that was
  // just marked" so a page load doesn't pop every tick already there.
  // Long enough for the row's reward animation (EpisodeRow) to play out.
  const CHECK_POP_MS = 600;
  let justWatchedId = $state<string | null>(null);

  function popCheck(episodeId: string) {
    justWatchedId = episodeId;
    setTimeout(() => {
      if (justWatchedId === episodeId) justWatchedId = null;
    }, CHECK_POP_MS);
  }

  function markWatched(episodeId: string) {
    onError("");
    markWatchedMut.mutate(episodeId);
  }

  /**
   * Entry point for every "Marquer vu" — asks first if it would silently
   * skip over earlier unwatched episodes. Whether it went straight through.
   */
  function requestMarkWatched(
    seasonNumber: number,
    episodeNumber: number,
    episodeId: string,
  ): boolean {
    const gap = unwatchedGapCount(seasons, seasonNumber, episodeNumber);
    if (gap > 0 && !declinedCatchup) {
      catchup = { episodeId, count: gap };
      return false;
    }
    markWatched(episodeId);
    return true;
  }

  function confirmCatchupYes() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    catchup = null;
    onError("");
    confirmCatchupYesMut.mutate(episodeId);
  }

  function confirmCatchupNo() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    declinedCatchup = true;
    catchup = null;
    markWatched(episodeId);
  }

  function markSeason(seasonId: string) {
    onError("");
    markSeasonMut.mutate(seasonId);
  }

  function confirmUnwatchSeason() {
    if (!confirmUnwatchSeasonId) return;
    onError("");
    confirmUnwatchSeasonMut.mutate(confirmUnwatchSeasonId);
  }

  function markUnwatch(episodeId: string) {
    onError("");
    markUnwatchMut.mutate(episodeId);
  }

  function reviewEpisode(
    season: MediaDetailSeasonDto,
    episode: MediaDetailEpisodeDto,
  ) {
    if (!episode.id) return;
    reviewTarget = {
      type: "EPISODE",
      id: episode.id,
      label: episodeCode(season.number, episode.number),
    };
  }

  function neighbour(target: { season: number; episode: number } | undefined) {
    if (!target) return null;
    const episode = seasons
      .find((s) => s.number === target.season)
      ?.episodes.find((e) => e.number === target.episode);
    if (!episode) return null;
    return {
      code: episodeCode(target.season, target.episode),
      title: episodeTitle(episode),
      go: () => openPanel(target),
    };
  }
</script>

<h2
  class="font-display mt-10 mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-bold">
  {m.media_episodes()}
  {#if isFeatureNew("episode-details")}<NewBadge />{/if}
  {#if entry}
    <span class="text-dim font-sans text-sm font-medium">{progressLabel}</span>
  {/if}
</h2>

<!-- Season cards: one open at most; clicking the open one closes it. They
     wrap onto new rows rather than scroll, so every season stays in reach. -->
<div class="grid grid-cols-2 gap-2.5 pb-2 sm:grid-cols-3 md:grid-cols-4">
  {#each seasons.filter((s) => s.episodes.length > 0) as season (season.number)}
    {@const open = selectedSeason === season.number}
    {@const watchedCount = seasonWatchedCount(season)}
    <button
      type="button"
      class="bg-surface relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border py-2 pr-3 pl-2 text-left transition-colors duration-150
        {open
        ? 'border-accent bg-accent/10'
        : 'border-border hover:border-dim/50'}"
      aria-expanded={open}
      onclick={() => toggleSeason(season.number)}>
      {#if season.posterUrl}
        <img
          src={season.posterUrl}
          alt=""
          loading="lazy"
          class="h-14 w-[2.4rem] shrink-0 rounded object-cover" />
      {:else}
        <span
          aria-hidden="true"
          class="timecode bg-surface-2 text-dim grid h-14 w-[2.4rem] shrink-0 place-items-center rounded text-xs">
          {season.number}
        </span>
      {/if}
      <span class="min-w-0">
        <span class="block truncate text-sm font-semibold">
          {seasonLabel(season)}
        </span>
        <span class="timecode text-dim mt-0.5 block text-[0.7rem]">
          {#if entry}{watchedCount}/{season.episodes
              .length}{:else}{m.media_season_episode_count({
              count: season.episodes.length,
            })}{/if}{#if season.voteAverage !== null}
            · TMDB {scoreLabel(season.voteAverage)}{/if}
        </span>
      </span>
      {#if entry}
        <span class="bg-border absolute inset-x-0 bottom-0 h-[3px]">
          <span
            class="block h-full transition-[width] duration-300 ease-out motion-reduce:transition-none
              {watchedCount === season.episodes.length
              ? 'bg-success'
              : 'bg-accent'}"
            style="width: {Math.round(
              (watchedCount / season.episodes.length) * 100,
            )}%"></span>
        </span>
      {/if}
    </button>
  {/each}
</div>

{#if current}
  {@const season = current}
  {@const pending = season.episodes.filter(
    (e) => e.id && e.watchCount === 0 && isAired(e, now),
  )}
  {@const watchedCount = seasonWatchedCount(season)}
  <!-- A whole season unfolds at once: a little slower than a menu, so the
       eye follows the list growing. -->
  <div
    transition:slide|global={{
      duration: reduced ? 0 : 300,
      easing: cubicOut,
    }}>
    <section
      class="border-border bg-surface mt-3 grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border p-3 sm:grid-cols-[5.75rem_minmax(0,1fr)] sm:p-4">
      {#if season.posterUrl && tmdbSourceId}
        {@const seasonNumber = season.number}
        <button
          type="button"
          class="group row-span-2 self-start overflow-hidden rounded-lg sm:row-span-3"
          aria-label={m.media_season_images()}
          onclick={() => (posterLightbox = seasonNumber)}>
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
              class="text-sm leading-relaxed" />
          {/key}
        </div>
      {/if}

      <div
        class="col-span-2 flex flex-wrap items-center gap-1 sm:col-span-1 sm:col-start-2">
        {#if entry && season.id}
          {@const seasonId = season.id}
          <button
            type="button"
            class="hover:bg-surface-2 inline-flex h-7 items-center gap-1 rounded-full px-1.5 text-xs transition-colors active:scale-95 motion-reduce:transition-none
              {season.myRating !== null
              ? 'text-accent'
              : 'text-dim hover:text-fg'}"
            aria-label={m.media_season_review()}
            title={m.media_season_review()}
            onclick={() =>
              (reviewTarget = {
                type: "SEASON",
                id: seasonId,
                label: seasonLabel(season),
              })}>
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
            title={seasonLabel(season)}
            canParticipate={!!entry}
            revealSpoilersByDefault={seasonWatched(season)}
            compact />
        {/if}
        {#if justFinished === season.number}
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
        {#if entry && season.id}
          {@const seasonId = season.id}
          {#if pending.length > 0}
            <button
              type="button"
              class="btn btn-ghost btn-sm ml-auto"
              disabled={markSeasonMut.loading &&
                markSeasonMut.variables === seasonId}
              onclick={() => markSeason(seasonId)}>
              <Icon name="check" class="h-4 w-4" />
              {m.media_mark_aired_watched()}
            </button>
          {:else if watchedCount > 0}
            <button
              type="button"
              class="btn btn-ghost btn-sm hover:text-danger ml-auto"
              onclick={() => (confirmUnwatchSeasonId = seasonId)}>
              {m.media_undo_season()}
            </button>
          {/if}
        {/if}
      </div>
    </section>

    <ul class="card mt-3 mb-4 overflow-hidden">
      {#each season.episodes as episode (episode.number)}
        <EpisodeRow
          {episode}
          seasonNumber={season.number}
          code={episodeCode(season.number, episode.number)}
          {exactTime}
          tracked={!!entry}
          {now}
          selected={openEpisode?.season === season.number &&
            openEpisode.episode === episode.number}
          highlighted={highlightedEpisode ===
            `s${season.number}e${episode.number}`}
          justWatched={!!episode.id && justWatchedId === episode.id}
          busy={!!episode.id && episodeBusy(episode.id)}
          onOpen={() =>
            openEpisode?.season === season.number &&
            openEpisode.episode === episode.number
              ? (openEpisode = null)
              : openPanel({ season: season.number, episode: episode.number })}
          onMark={() =>
            episode.id &&
            requestMarkWatched(season.number, episode.number, episode.id)}
          onReview={() => reviewEpisode(season, episode)} />
      {/each}
    </ul>
  </div>
{/if}

{#if panel}
  {@const { season, episode, before, after } = panel}
  <EpisodePanel
    {episode}
    seasonNumber={season.number}
    code={episodeCode(season.number, episode.number)}
    {exactTime}
    tracked={!!entry}
    {now}
    {tmdbSourceId}
    busy={!!episode.id && episodeBusy(episode.id)}
    previous={neighbour(before)}
    next={neighbour(after)}
    onClose={() => (openEpisode = null)}
    onMark={() => {
      if (!episode.id) return;
      // Straight through: move on to the next one, as when watching.
      const done = requestMarkWatched(
        season.number,
        episode.number,
        episode.id,
      );
      if (done && after) openPanel(after);
    }}
    onRewatch={() => episode.id && markWatched(episode.id)}
    onUndo={() => episode.id && markUnwatch(episode.id)}
    onReview={() => reviewEpisode(season, episode)} />
{/if}

{#if posterLightbox !== null && posterImages.length > 0}
  <Lightbox images={posterImages} onClose={() => (posterLightbox = null)} />
{/if}

{#if catchup}
  {@const c = catchup}
  <ConfirmationModal
    title={m.media_catch_up_title()}
    message={m.media_catch_up_message({ count: c.count })}
    confirmLabel={m.media_catch_up_confirm()}
    cancelLabel={m.media_catch_up_cancel()}
    busy={confirmCatchupYesMut.loading}
    onConfirm={confirmCatchupYes}
    onCancel={confirmCatchupNo} />
{/if}

{#if confirmUnwatchSeasonId}
  <ConfirmationModal
    title={m.media_undo_season_title()}
    message={m.media_undo_season_message()}
    confirmLabel={m.media_undo_all()}
    danger
    busy={confirmUnwatchSeasonMut.loading}
    onConfirm={confirmUnwatchSeason}
    onCancel={() => (confirmUnwatchSeasonId = null)} />
{/if}

{#if reviewTarget}
  <Modal
    title={m.media_review_title({ target: reviewTarget.label })}
    onclose={closeReview}>
    <ReviewsSection
      targetType={reviewTarget.type}
      targetId={reviewTarget.id}
      workTitle={reviewTarget.label}
      compact />
  </Modal>
{/if}
