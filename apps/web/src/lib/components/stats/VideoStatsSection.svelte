<script lang="ts">
  // "Vidéo — en détail" section of /stats. Self-contained: fetches on mount,
  // reuses the MEDIA status breakdown already loaded by the overview (avoids
  // re-deriving "en cours" from scratch) and StatsWorksModal for the
  // ghost/paused drill-down, same pattern as the ratings/decades modal.
  import { getVideoSeries, getVideoStats } from "$lib/api/stats";
  import type {
    DomainStatusBreakdownDto,
    StatsWorkDto,
    VideoStatsDto,
    WatchStaleness,
  } from "@loomkeep/shared";
  import RankBars from "./RankBars.svelte";
  import StackedBar from "./StackedBar.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatsWorksModal from "./StatsWorksModal.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    mediaBreakdown,
  }: { mediaBreakdown: DomainStatusBreakdownDto | undefined } = $props();

  const videoStats = statsResource<VideoStatsDto>(
    getVideoStats,
    "Statistiques vidéo indisponibles",
  );
  const video = $derived(videoStats.data);
  const error = $derived(videoStats.error);

  const inProgressCount = $derived(
    mediaBreakdown?.byStatus.find((s) => s.bucket === "IN_PROGRESS")?.count ??
      0,
  );

  const hours = $derived(video ? Math.round(video.totalMinutes / 60) : 0);
  const days = $derived(video ? Math.round(video.totalMinutes / 1440) : 0);
  const rewatches = $derived(
    video ? video.episodesWatched - video.uniqueEpisodesWatched : 0,
  );

  const TYPE_LABEL: Record<string, string> = {
    MOVIE: "Films",
    SERIES: "Séries",
    ANIME: "Animés",
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

  const genreItems = $derived(
    video ? video.genres.map((g) => ({ label: g.genre, value: g.count })) : [],
  );

  // Ghost/paused drill-down modal — same StatsWorksModal as ratings/decades.
  let modalKind = $state<WatchStaleness | null>(null);
  let modalWorks = $state<StatsWorkDto[]>([]);
  let modalLoading = $state(false);

  function openStaleness(kind: WatchStaleness) {
    modalKind = kind;
    modalLoading = true;
    getVideoSeries(kind)
      .then((w) => (modalWorks = w))
      .finally(() => (modalLoading = false));
  }
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if video}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
    <StatTile
      value={hours}
      unit="h"
      label="Temps de visionnage"
      hint="≈ {days} jours" />
    <StatTile
      value={video.episodesWatched}
      label="Épisodes vus"
      hint="dont {rewatches} revus" />
    <StatTile
      value={video.seasonsCompleted}
      label="Saisons terminées"
      hint="{inProgressCount} en cours" />
    <StatTile
      value={video.avgEpisodeRuntimeMin ?? "—"}
      unit="min"
      label="Durée moy. / épisode" />
    <StatTile value={video.moviesRewatchedCount} label="Films revus" />
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-display text-lg font-bold">Films · Séries · Animés</h3>
      </div>
      <StackedBar
        segments={typeSegments}
        toggle={{ primaryLabel: "Temps", altLabel: "Nombre" }} />
      {#if video.longestFilm || video.shortestFilm}
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          {#if video.longestFilm}
            <a href={video.longestFilm.href} class="hover:text-accent">
              <span class="text-dim block uppercase">Film le + long</span>
              <span class="truncate font-semibold"
                >{video.longestFilm.title}</span>
              <span class="timecode block"
                >{Math.floor(video.longestFilm.minutes / 60)}h{(
                  video.longestFilm.minutes % 60
                )
                  .toString()
                  .padStart(2, "0")}</span>
            </a>
          {/if}
          {#if video.shortestFilm}
            <a href={video.shortestFilm.href} class="hover:text-accent">
              <span class="text-dim block uppercase">Film le + court</span>
              <span class="truncate font-semibold"
                >{video.shortestFilm.title}</span>
              <span class="timecode block"
                >{video.shortestFilm.minutes}min</span>
            </a>
          {/if}
        </div>
      {/if}
    </section>

    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">Genres favoris</h3>
      <RankBars items={genreItems} />
    </section>
  </div>

  <section class="card mt-5 p-5">
    <h3 class="font-display mb-1 text-lg font-bold">Suivi des séries</h3>
    <p class="text-dim mb-4 text-sm">
      Combien de séries commencées attendent une décision.
    </p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="bg-surface-2 border-border rounded-lg border p-3">
        <p class="font-display text-xl font-bold">{inProgressCount}</p>
        <p class="text-dim text-xs">En cours</p>
      </div>
      <div class="bg-surface-2 border-border rounded-lg border p-3">
        <p class="text-accent font-display text-xl font-bold">
          {video.pausedCount}
        </p>
        <p class="text-dim text-xs">En pause · &gt; 30 j</p>
        {#if video.pausedCount > 0}
          <button
            class="text-accent mt-1 text-xs font-semibold"
            onclick={() => openStaleness("PAUSED")}>
            voir ▾
          </button>
        {/if}
      </div>
      <div class="bg-surface-2 border-border rounded-lg border p-3">
        <p class="text-danger font-display text-xl font-bold">
          {video.ghostCount}
        </p>
        <p class="text-dim text-xs">Fantômes · &gt; 6 mois</p>
        {#if video.ghostCount > 0}
          <button
            class="text-accent mt-1 text-xs font-semibold"
            onclick={() => openStaleness("GHOST")}>
            voir ▾
          </button>
        {/if}
      </div>
      <div class="bg-surface-2 border-border rounded-lg border p-3">
        <p class="font-display text-xl font-bold">{video.longestBingeCount}</p>
        <p class="text-dim text-xs">Plus long binge (24 h)</p>
      </div>
    </div>
  </section>
{/if}

{#if modalKind}
  <StatsWorksModal
    title={modalKind === "PAUSED" ? "Séries en pause" : "Séries fantômes"}
    works={modalWorks}
    loading={modalLoading}
    onclose={() => (modalKind = null)} />
{/if}
