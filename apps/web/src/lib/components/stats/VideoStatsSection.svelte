<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // "Vidéo — en détail" section of /stats. Self-contained: fetches on mount,
  // reuses the MEDIA status breakdown already loaded by the overview (avoids
  // re-deriving "en cours" from scratch) and StatsWorksModal for the
  // ghost/paused drill-down, same pattern as the ratings/decades modal.
  import { resolveApiError } from "$lib/api/errors";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getVideoSeries, getVideoStats } from "$lib/api/stats";
  import type {
    DomainStatusBreakdownDto,
    StatsWorkDto,
    WatchStaleness,
  } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import StackedBar from "./StackedBar.svelte";
  import StatsWorksModal from "./StatsWorksModal.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    mediaBreakdown,
    locked,
  }: {
    mediaBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const videoStats = createApiQuery(() => ({
    key: keys.stats.video(),
    fetch: getVideoStats,
  }));
  const video = $derived(videoStats.data);
  const error = $derived(videoStats.error);

  const inProgressCount = $derived(
    mediaBreakdown?.byStatus.find((s) => s.bucket === "IN_PROGRESS")?.count ??
      0,
  );

  const hours = $derived(video ? Math.round(video.totalMinutes / 60) : 0);
  const days = $derived(video ? Math.round(video.totalMinutes / 1440) : 0);

  const TYPE_LABEL: Record<string, string> = {
    MOVIE: m.media_movies(),
    SERIES: m.media_series_plural(),
    ANIME: m.media_anime(),
  };
  const TYPE_TINT: Record<string, string> = {
    SERIES: "var(--stat-media)",
    ANIME: "color-mix(in srgb, var(--stat-media) 55%, var(--surface))",
    MOVIE: "color-mix(in srgb, var(--stat-media) 25%, var(--surface))",
  };

  const typeSegments = $derived(
    video
      ? video.typeSplit.map((t) => ({
          label: TYPE_LABEL[t.type] ?? t.type,
          color: TYPE_TINT[t.type] ?? "var(--stat-media)",
          value: Math.round(t.minutes / 60),
          altValue: t.count,
        }))
      : [],
  );

  // Static, made-up previews shown instead of the real (redacted) advanced
  // fields when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment.
  const FAKE_GENRES = [
    { label: "Action", value: 14 },
    { label: m.stats_preview_drama(), value: 11 },
    { label: m.stats_preview_comedy(), value: 8 },
    { label: "Thriller", value: 5 },
  ];
  const FAKE_LONGEST_FILM = { title: m.stats_preview_movie(), minutes: 172 };
  const FAKE_SHORTEST_FILM = {
    title: m.stats_preview_short_movie(),
    minutes: 62,
  };
  const FAKE_TRACKING = {
    moviesRewatched: 3,
    paused: 2,
    ghost: 1,
    longestBinge: 4,
  };

  const genreItems = $derived(
    locked
      ? FAKE_GENRES
      : video
        ? video.genres.map((g) => ({ label: g.genre, value: g.count }))
        : [],
  );

  const moviesRewatchedCount = $derived(
    locked ? FAKE_TRACKING.moviesRewatched : (video?.moviesRewatchedCount ?? 0),
  );
  const pausedCount = $derived(
    locked ? FAKE_TRACKING.paused : (video?.pausedCount ?? 0),
  );
  const ghostCount = $derived(
    locked ? FAKE_TRACKING.ghost : (video?.ghostCount ?? 0),
  );
  const longestBingeCount = $derived(
    locked ? FAKE_TRACKING.longestBinge : (video?.longestBingeCount ?? 0),
  );

  // Ghost/paused drill-down modal — same StatsWorksModal as ratings/decades.
  let modalKind = $state<WatchStaleness | null>(null);
  let modalWorks = $state<StatsWorkDto[]>([]);
  let modalLoading = $state(false);
  let modalError = $state<string | null>(null);

  function openStaleness(kind: WatchStaleness) {
    modalKind = kind;
    modalLoading = true;
    modalError = null;
    getVideoSeries(kind)
      .then((w) => (modalWorks = w))
      .catch((e) => (modalError = resolveApiError(e)))
      .finally(() => (modalLoading = false));
  }
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if video}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={hours}
      unit={m.common_hours_short()}
      label={m.stats_video_watch_time()}
      hint={days === 1
        ? m.stats_approx_day({ days })
        : m.stats_approx_days({ days })} />
    <StatTile value={video.episodesWatched} label={m.stats_video_episodes()} />
    <StatTile
      value={video.seasonsCompleted}
      label={m.stats_video_seasons()}
      hint={m.stats_video_progress_count({ count: inProgressCount })} />
    <StatTile
      value={video.avgEpisodeRuntimeMin ?? "—"}
      unit={m.common_minutes_short()}
      label={m.stats_video_average_episode()} />
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-display text-lg font-bold">
          {m.stats_video_type_split()}
        </h3>
      </div>
      <StackedBar
        segments={typeSegments}
        toggle={{
          primaryLabel: m.common_time(),
          altLabel: m.common_count(),
        }} />
      {#if locked || video.longestFilm || video.shortestFilm}
        {@const longestFilm = locked ? FAKE_LONGEST_FILM : video.longestFilm}
        {@const shortestFilm = locked ? FAKE_SHORTEST_FILM : video.shortestFilm}
        <PremiumTeaser {locked} class="mt-4">
          <div class="grid grid-cols-2 gap-2 text-xs">
            {#if longestFilm}
              <a
                href={locked ? "#" : video.longestFilm?.href}
                class="hover:text-accent">
                <span class="text-dim block uppercase"
                  >{m.stats_video_longest()}</span>
                <span class="truncate font-semibold">{longestFilm.title}</span>
                <span class="timecode block"
                  >{Math.floor(
                    longestFilm.minutes / 60,
                  )}{m.common_hours_short()}{(longestFilm.minutes % 60)
                    .toString()
                    .padStart(2, "0")}</span>
              </a>
            {/if}
            {#if shortestFilm}
              <a
                href={locked ? "#" : video.shortestFilm?.href}
                class="hover:text-accent">
                <span class="text-dim block uppercase"
                  >{m.stats_video_shortest()}</span>
                <span class="truncate font-semibold">{shortestFilm.title}</span>
                <span class="timecode block"
                  >{shortestFilm.minutes}{m.common_minutes_short()}</span>
              </a>
            {/if}
          </div>
        </PremiumTeaser>
      {/if}
    </section>

    <PremiumTeaser {locked}>
      <section class="card p-5">
        <h3 class="font-display mb-4 text-lg font-bold">
          {m.stats_favorite_genres()}
        </h3>
        <RankBars items={genreItems} />
      </section>
    </PremiumTeaser>
  </div>

  <section class="card mt-5 p-5">
    <h3 class="font-display mb-1 text-lg font-bold">
      {m.stats_video_tracking()}
    </h3>
    <p class="text-dim mb-4 text-sm">
      {m.stats_video_tracking_hint()}
    </p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="bg-surface-2 border-border rounded-lg border p-3">
        <p class="font-display text-xl font-bold">{inProgressCount}</p>
        <p class="text-dim text-xs">{m.library_status_in_progress()}</p>
      </div>
    </div>
    <PremiumTeaser {locked} class="mt-3 block">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="bg-surface-2 border-border rounded-lg border p-3">
          <p class="font-display text-xl font-bold">{moviesRewatchedCount}</p>
          <p class="text-dim text-xs">{m.stats_video_rewatched()}</p>
        </div>
        <div class="bg-surface-2 border-border rounded-lg border p-3">
          <p class="text-accent font-display text-xl font-bold">
            {pausedCount}
          </p>
          <p class="text-dim text-xs">{m.stats_video_paused_old()}</p>
          {#if !locked && video.pausedCount > 0}
            <button
              class="text-accent mt-1 text-xs font-semibold"
              onclick={() => openStaleness("PAUSED")}>
              {m.common_see()} ▾
            </button>
          {/if}
        </div>
        <div class="bg-surface-2 border-border rounded-lg border p-3">
          <p class="text-danger font-display text-xl font-bold">
            {ghostCount}
          </p>
          <p class="text-dim text-xs">{m.stats_video_ghost_old()}</p>
          {#if !locked && video.ghostCount > 0}
            <button
              class="text-accent mt-1 text-xs font-semibold"
              onclick={() => openStaleness("GHOST")}>
              {m.common_see()} ▾
            </button>
          {/if}
        </div>
        <div class="bg-surface-2 border-border rounded-lg border p-3">
          <p class="font-display text-xl font-bold">{longestBingeCount}</p>
          <p class="text-dim text-xs">{m.stats_video_longest_binge()}</p>
        </div>
      </div>
    </PremiumTeaser>
  </section>
{/if}

{#if modalKind}
  <StatsWorksModal
    title={modalKind === "PAUSED"
      ? m.stats_video_paused_series()
      : m.stats_video_ghost_series()}
    works={modalWorks}
    loading={modalLoading}
    error={modalError}
    onclose={() => (modalKind = null)} />
{/if}
