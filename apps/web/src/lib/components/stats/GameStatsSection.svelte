<script lang="ts">
  // "Jeux — en détail" section of /stats. Self-contained: fetches on mount,
  // reuses the GAMES status breakdown already loaded by the overview for
  // "Terminés" (avoids re-deriving it from scratch), same pattern as the
  // Vidéo section.
  import type {
    DomainStatusBreakdownDto,
    GameStatsDto,
  } from "@loomkeep/shared";
  import { getGameStats } from "$lib/api/stats";
  import RankBars from "./RankBars.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatTile from "./StatTile.svelte";
  import StatTilesSkeleton from "./StatTilesSkeleton.svelte";

  let {
    gameBreakdown,
  }: { gameBreakdown: DomainStatusBreakdownDto | undefined } = $props();

  const gameStats = statsResource<GameStatsDto>(
    getGameStats,
    "Statistiques jeux indisponibles",
  );
  const games = $derived(gameStats.data);
  const loading = $derived(gameStats.loading);
  const error = $derived(gameStats.error);

  const completedCount = $derived(
    gameBreakdown?.byStatus.find((s) => s.bucket === "DONE")?.count ?? 0,
  );

  const hours = $derived(
    games ? Math.round(games.totalPlaytimeMinutes / 60) : 0,
  );
  const days = $derived(
    games ? Math.round(games.totalPlaytimeMinutes / 1440) : 0,
  );
  const avgHoursPerCompleted = $derived(
    games?.avgPlaytimePerCompletedMinutes
      ? Math.round(games.avgPlaytimePerCompletedMinutes / 60)
      : null,
  );

  const topGamesItems = $derived(
    games
      ? games.topGamesByPlaytime.map((g) => ({
          label: g.title,
          value: Math.round(g.minutes / 60),
        }))
      : [],
  );
  const platformItems = $derived(
    games
      ? games.topPlatforms.map((p) => ({ label: p.label, value: p.count }))
      : [],
  );
  const genreItems = $derived(
    games
      ? games.topGenres.map((g) => ({ label: g.label, value: g.count }))
      : [],
  );
  const ratingByPlatformItems = $derived(
    games
      ? games.avgRatingByPlatform.map((r) => ({
          label: r.label,
          value: r.averageRating,
        }))
      : [],
  );
  const ratingByGenreItems = $derived(
    games
      ? games.avgRatingByGenre.map((r) => ({
          label: r.label,
          value: r.averageRating,
        }))
      : [],
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if loading}
  <StatTilesSkeleton />
{:else if games}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={hours}
      unit="h"
      label="Temps de jeu"
      hint="≈ {days} jours" />
    <StatTile
      value={completedCount}
      label="Terminés"
      hint={avgHoursPerCompleted !== null
        ? `temps moy. ${avgHoursPerCompleted}h`
        : undefined} />
    <StatTile value={games.neverLaunchedCount} label="Jamais lancés" />
    <StatTile value={games.replaysCount} label="Rejouées" />
  </div>

  <section class="card mt-5 p-5">
    <h3 class="font-display mb-4 text-lg font-bold">
      Top jeux par temps de jeu
    </h3>
    {#if topGamesItems.length > 0}
      <RankBars items={topGamesItems} />
    {:else}
      <p class="text-dim text-sm">Pas encore de temps de jeu enregistré.</p>
    {/if}
  </section>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">Plateformes</h3>
      <RankBars items={platformItems} />
    </section>
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">Genres favoris</h3>
      <RankBars items={genreItems} />
    </section>
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Note moyenne par plateforme
      </h3>
      {#if ratingByPlatformItems.length > 0}
        <RankBars items={ratingByPlatformItems} />
      {:else}
        <p class="text-dim text-sm">Pas encore de jeu noté.</p>
      {/if}
    </section>
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Note moyenne par genre
      </h3>
      {#if ratingByGenreItems.length > 0}
        <RankBars items={ratingByGenreItems} />
      {:else}
        <p class="text-dim text-sm">Pas encore de jeu noté.</p>
      {/if}
    </section>
  </div>
{/if}
