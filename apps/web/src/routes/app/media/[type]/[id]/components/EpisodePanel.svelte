<script lang="ts">
  import { getEpisodeMedia } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import SidePanel from "#lib/components/SidePanel.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { layout } from "#lib/layout.svelte.js";
  import { formatRuntimeTimecode } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailEpisodeDto } from "@loomkeep/shared";
  import { fade } from "svelte/transition";
  import { airDateLabel, scoreLabel, upcomingLabel } from "./episode-format";
  import EpisodeMediaSlider from "./EpisodeMediaSlider.svelte";
  import { isAired, largeTmdbImage } from "./episodes";
  import WatchTimeline from "./WatchTimeline.svelte";

  type Neighbour = { code: string; title: string; go: () => void } | null;

  let {
    episode,
    seasonNumber,
    code,
    exactTime,
    tracked,
    now,
    tmdbSourceId,
    busy = false,
    previous,
    next,
    onClose,
    onMark,
    onRewatch,
    onUndo,
    onReview,
  }: {
    episode: MediaDetailEpisodeDto;
    seasonNumber: number;
    code: string;
    exactTime: boolean;
    tracked: boolean;
    now: Date;
    /** A TMDB series' id: its episodes have a live gallery. */
    tmdbSourceId: string | null;
    busy?: boolean;
    previous: Neighbour;
    next: Neighbour;
    onClose: () => void;
    onMark: () => void;
    onRewatch: () => void;
    onUndo: () => void;
    onReview: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  // Desktop: ← and → step through the episodes, unless the keys belong to
  // something else — a field being typed in, or a dialog opened on top
  // (the lightbox, a review) that has its own use for them.
  function onKeydown(event: KeyboardEvent) {
    if (layout.compact || event.defaultPrevented) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.isContentEditable ||
      target?.closest("input, textarea, select")
    ) {
      return;
    }
    if (document.querySelectorAll('[role="dialog"]').length > 1) return;

    const step = event.key === "ArrowLeft" ? previous : next;
    if (!step) return;
    event.preventDefault();
    step.go();
  }

  const title = $derived(
    episode.title ?? `${m.common_episode()} ${episode.number}`,
  );
  const watched = $derived(episode.watchCount > 0);
  const upcoming = $derived(
    watched ? null : upcomingLabel(episode.airDate, now, exactTime),
  );

  // One TMDB call per episode, so only once its panel is open.
  const mediaQuery = createApiQuery(() => ({
    key: keys.media.episodeMedia(
      tmdbSourceId ?? "",
      seasonNumber,
      episode.number,
    ),
    fetch: () => getEpisodeMedia(tmdbSourceId!, seasonNumber, episode.number),
    enabled: !!tmdbSourceId,
    retry: 0,
  }));
  const images = $derived.by(() => {
    const main = episode.stillUrl ? [largeTmdbImage(episode.stillUrl)] : [];
    return [...new Set([...main, ...(mediaQuery.data?.images ?? [])])];
  });
  const imageSource = $derived(
    episode.stillUrl
      ? m.media_episode_image_source({
          source: exactTime ? (episode.streamingSite ?? "AniList") : "TMDB",
        })
      : null,
  );
</script>

<svelte:window onkeydown={onKeydown} />

<SidePanel
  onclose={onClose}
  labelledby="episode-panel-title"
  desktopClass="max-w-lg">
  <header
    class="border-border flex shrink-0 items-center gap-1 border-b py-2 pr-2 pl-4">
    {#if layout.compact}
      <button
        type="button"
        class="btn-icon -ml-2"
        aria-label={m.common_back()}
        onclick={onClose}>
        <Icon name="chevron-left" class="h-5 w-5" />
      </button>
    {/if}
    <h2
      id="episode-panel-title"
      class="min-w-0 flex-1 truncate text-sm font-semibold">
      <span class="timecode text-dim mr-1.5 text-xs">{code}</span>{title}
    </h2>
    {#if tracked && episode.id}
      <button
        type="button"
        class="btn-icon {episode.myRating !== null ? 'text-accent' : ''}"
        aria-label={m.media_episode_review()}
        title={m.media_episode_review()}
        onclick={onReview}>
        <Icon name="star" class="h-4.5 w-4.5" />
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
    {#if !layout.compact}
      <button
        type="button"
        class="btn-icon"
        aria-label={m.common_close()}
        onclick={onClose}>
        <Icon name="x" class="h-5 w-5" />
      </button>
    {/if}
  </header>

  <!-- Only this part scrolls: previous/next stay put below it, whatever
       the synopsis length. -->
  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
    {#key episode.id ?? episode.number}
      <div in:fade={{ duration: reduced ? 0 : 160 }}>
        <EpisodeMediaSlider
          {images}
          videos={mediaQuery.data?.videos ?? []}
          alt={title}
          caption={imageSource}
          overlay={upcoming} />

        <p class="font-display mt-4 text-2xl leading-tight font-bold">
          {title}
        </p>

        <dl
          class="border-border bg-border mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border">
          <div class="bg-surface px-3 py-2">
            <dt class="timecode text-dim text-[0.65rem] uppercase">
              {m.media_episode_air_date()}
            </dt>
            <dd class="mt-0.5 text-sm">
              {episode.airDate
                ? airDateLabel(episode.airDate, exactTime, true)
                : "—"}
            </dd>
          </div>
          <div class="bg-surface px-3 py-2">
            <dt class="timecode text-dim text-[0.65rem] uppercase">
              {m.media_episode_runtime()}
            </dt>
            <dd class="timecode mt-0.5 text-sm">
              {episode.runtimeMin
                ? formatRuntimeTimecode(episode.runtimeMin)
                : "—"}
            </dd>
          </div>
          <div class="bg-surface px-3 py-2">
            <dt class="timecode text-dim text-[0.65rem] uppercase">TMDB</dt>
            <dd class="mt-0.5 text-sm">
              {#if episode.voteAverage !== null}
                <span class="timecode text-accent"
                  >{scoreLabel(episode.voteAverage)}</span>
                <span class="text-dim ml-1.5 text-xs">
                  {m.media_episode_votes({ count: episode.voteCount ?? 0 })}
                </span>
              {:else}—{/if}
            </dd>
          </div>
          <div class="bg-surface px-3 py-2">
            <dt class="timecode text-dim text-[0.65rem] uppercase">Loomkeep</dt>
            <dd class="mt-0.5 text-sm">
              {#if episode.reviewAverage !== null}
                <span class="timecode"
                  >{scoreLabel(episode.reviewAverage)}</span>
                <span class="text-dim ml-1.5 text-xs">
                  {m.media_episode_review_count({
                    count: episode.reviewCount ?? 0,
                  })}
                </span>
              {:else}—{/if}
            </dd>
          </div>
        </dl>

        {#if episode.overview}
          <p class="mt-4 leading-relaxed">{episode.overview}</p>
        {:else}
          <p class="text-dim mt-4 text-sm">
            {exactTime
              ? m.media_episode_no_synopsis_anime()
              : m.media_episode_no_synopsis()}
          </p>
        {/if}

        {#if tracked && episode.id && !watched && isAired(episode, now)}
          <!-- The panel's main action: as wide as the panel, easy to hit. -->
          <button
            type="button"
            class="btn btn-primary mt-5 w-full py-3 text-base"
            disabled={busy}
            onclick={onMark}>
            <Icon name="check" class="h-5 w-5" />
            {m.media_mark_watched_short()}
          </button>
        {/if}

        {#if (tracked && episode.id && watched) || episode.streamingUrl}
          <div class="mt-5 flex flex-wrap gap-2">
            {#if tracked && episode.id && watched}
              <button
                type="button"
                class="btn btn-ghost"
                disabled={busy}
                onclick={onRewatch}>
                <Icon name="refresh" class="h-4 w-4" />
                {m.media_rewatch()}
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                disabled={busy}
                onclick={onUndo}>
                {m.media_undo_watch()}
              </button>
            {/if}
            {#if episode.streamingUrl && episode.streamingSite}
              <a
                class="btn btn-ghost"
                href={episode.streamingUrl}
                target="_blank"
                rel="noopener noreferrer">
                <Icon name="play" class="h-4 w-4" />
                {m.media_watch_on({ site: episode.streamingSite })}
              </a>
            {/if}
          </div>
        {/if}

        {#if tracked && episode.id}
          <section class="border-border mt-6 border-t pt-4">
            <h3
              class="timecode text-dim flex items-center justify-between text-[0.7rem] uppercase">
              {m.media_episode_history()}
              {#if episode.watches.length > 1}
                <span
                  >{m.media_episode_times({
                    count: episode.watches.length,
                  })}</span>
              {/if}
            </h3>
            {#if episode.watches.length > 0}
              <div class="mt-3">
                <WatchTimeline watches={episode.watches} />
              </div>
            {:else}
              <p class="text-dim mt-2 text-sm">
                {m.media_episode_not_watched()}
              </p>
            {/if}
          </section>
        {/if}
      </div>
    {/key}
  </div>

  <footer class="border-border bg-bg flex shrink-0 gap-2 border-t px-4 py-3">
    <!-- Nothing before the first episode or after the last: the side stays
         empty rather than offering a dead button. -->
    {#each [{ n: previous, prev: true }, { n: next, prev: false }] as nav (nav.prev)}
      {#if nav.n}
        {@const target = nav.n}
        <button
          type="button"
          class="border-border bg-surface hover:bg-surface-2 hover:border-dim/40 min-w-0 flex-1 rounded-xl border px-3 py-2 transition-colors
            {nav.prev ? 'text-left' : 'text-right'}"
          aria-label={nav.prev
            ? m.media_episode_previous()
            : m.media_episode_next()}
          onclick={target.go}>
          <span class="timecode text-dim block text-[0.65rem]">
            {nav.prev ? `‹ ${target.code}` : `${target.code} ›`}
          </span>
          <span class="block truncate text-sm">{target.title}</span>
        </button>
      {:else}
        <span class="flex-1" aria-hidden="true"></span>
      {/if}
    {/each}
  </footer>
</SidePanel>
