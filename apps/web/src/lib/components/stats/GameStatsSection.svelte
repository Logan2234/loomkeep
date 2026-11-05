<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getGameStats } from "#lib/api/stats.js";
  import type { DomainStatusBreakdownDto } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    gameBreakdown,
    locked,
  }: {
    gameBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const gameStats = createApiQuery(() => ({
    key: keys.stats.games(),
    fetch: getGameStats,
  }));
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
{:else if games}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
    <StatTile
      value={hours}
      unit={m.common_hours_short()}
      label={m.game_playtime()}
      hint={days === 1
        ? m.stats_approx_day({ days })
        : m.stats_approx_days({ days })} />
    <StatTile
      value={completedCount}
      label={m.stats_games_completed()}
      hint={avgHoursPerCompleted !== null
        ? m.stats_games_average_time({ hours: avgHoursPerCompleted })
        : undefined} />
    <StatTile
      value={games.neverLaunchedCount}
      label={m.stats_games_never_launched()} />
    <StatTile
      value={games.pausedInProgressCount}
      label={m.stats_games_paused()} />
    <StatTile value={games.replaysCount} label={m.stats_games_replays()} />
  </div>

  <PremiumTeaser {locked} class="mt-5 block">
    <section class="panel md:p-5">
      <h3 class="panel-head font-display text-lg font-bold md:mb-4">
        {m.stats_games_top_playtime()}
      </h3>
      <div class="panel-body">
        {#if topGamesItems.length > 0}
          <RankBars items={topGamesItems} />
        {:else}
          <p class="text-dim text-sm">{m.stats_games_no_playtime()}</p>
        {/if}
      </div>
    </section>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.game_platforms()}
        </h3>
        <div class="panel-body">
          <RankBars items={platformItems} />
        </div>
      </section>
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.stats_favorite_genres()}
        </h3>
        <div class="panel-body">
          <RankBars items={genreItems} />
        </div>
      </section>
    </div>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.stats_games_rating_platform()}
        </h3>
        <div class="panel-body">
          {#if ratingByPlatformItems.length > 0}
            <RankBars items={ratingByPlatformItems} />
          {:else}
            <p class="text-dim text-sm">{m.stats_games_no_ratings()}</p>
          {/if}
        </div>
      </section>
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.stats_rating_genre()}
        </h3>
        <div class="panel-body">
          {#if ratingByGenreItems.length > 0}
            <RankBars items={ratingByGenreItems} />
          {:else}
            <p class="text-dim text-sm">{m.stats_games_no_ratings()}</p>
          {/if}
        </div>
      </section>
    </div>
  </PremiumTeaser>
{/if}
