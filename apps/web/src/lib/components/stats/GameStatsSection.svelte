<script lang="ts">
  // "Jeux — en détail" section of /stats. Self-contained: fetches on mount,
  // reuses the GAMES status breakdown already loaded by the overview for
  // "Terminés" (avoids re-deriving it from scratch), same pattern as the
  // Vidéo section.
  import { getGameStats } from "$lib/api/stats";
  import type {
    DomainStatusBreakdownDto,
    GameStatsDto,
  } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    gameBreakdown,
    locked,
  }: {
    gameBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const gameStats = statsResource<GameStatsDto>(getGameStats);
  const games = $derived(gameStats.data);
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

  // Static, made-up previews shown instead of the real (redacted) advanced
  // fields when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment.
  const FAKE_TOP_GAMES = [
    { label: "Un jeu marquant", value: 24 },
    { label: "Un autre favori", value: 16 },
    { label: "Découverte récente", value: 9 },
  ];
  const FAKE_PLATFORMS = [
    { label: "PC", value: 5 },
    { label: "Switch", value: 3 },
    { label: "PS5", value: 2 },
  ];
  const FAKE_GENRES = [
    { label: "Action", value: 6 },
    { label: "Rogue-like", value: 4 },
    { label: "Puzzle", value: 2 },
  ];
  const FAKE_RATING_BY_PLATFORM = [
    { label: "PC", value: 8.4 },
    { label: "Switch", value: 7.9 },
  ];
  const FAKE_RATING_BY_GENRE = [
    { label: "Action", value: 8.1 },
    { label: "Rogue-like", value: 7.6 },
  ];

  const topGamesItems = $derived(
    locked
      ? FAKE_TOP_GAMES
      : games
        ? games.topGamesByPlaytime.map((g) => ({
            label: g.title,
            value: Math.round(g.minutes / 60),
          }))
        : [],
  );
  const platformItems = $derived(
    locked
      ? FAKE_PLATFORMS
      : games
        ? games.topPlatforms.map((p) => ({ label: p.label, value: p.count }))
        : [],
  );
  const genreItems = $derived(
    locked
      ? FAKE_GENRES
      : games
        ? games.topGenres.map((g) => ({ label: g.label, value: g.count }))
        : [],
  );
  const ratingByPlatformItems = $derived(
    locked
      ? FAKE_RATING_BY_PLATFORM
      : games
        ? games.avgRatingByPlatform.map((r) => ({
            label: r.label,
            value: r.averageRating,
          }))
        : [],
  );
  const ratingByGenreItems = $derived(
    locked
      ? FAKE_RATING_BY_GENRE
      : games
        ? games.avgRatingByGenre.map((r) => ({
            label: r.label,
            value: r.averageRating,
          }))
        : [],
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
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

  <PremiumTeaser {locked} class="mt-5 block">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Top jeux par temps de jeu
      </h3>
      {#if locked || topGamesItems.length > 0}
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
        {#if locked || ratingByPlatformItems.length > 0}
          <RankBars items={ratingByPlatformItems} />
        {:else}
          <p class="text-dim text-sm">Pas encore de jeu noté.</p>
        {/if}
      </section>
      <section class="card p-5">
        <h3 class="font-display mb-4 text-lg font-bold">
          Note moyenne par genre
        </h3>
        {#if locked || ratingByGenreItems.length > 0}
          <RankBars items={ratingByGenreItems} />
        {:else}
          <p class="text-dim text-sm">Pas encore de jeu noté.</p>
        {/if}
      </section>
    </div>
  </PremiumTeaser>
{/if}
