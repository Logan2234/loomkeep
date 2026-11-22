<script lang="ts">
  import { formatNumber } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailSeasonDto } from "@loomkeep/shared";
  import { ratingBand, RATING_BANDS } from "./episode-ratings";

  let {
    seasons,
    onOpen,
  }: {
    seasons: MediaDetailSeasonDto[];
    onOpen: (target: { season: number; episode: number }) => void;
  } = $props();

  // Specials have no place in a season-by-episode reading of the run.
  const rows = $derived(
    seasons
      .filter((s) => s.number > 0 && s.episodes.length > 0)
      .sort((a, b) => a.number - b.number),
  );
  const columns = $derived(
    Math.max(
      0,
      ...rows.map((s) => Math.max(...s.episodes.map((e) => e.number))),
    ),
  );

  const score = (value: number) =>
    formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
</script>

<div class="overflow-x-auto pb-1">
  <table class="border-separate border-spacing-[3px] text-xs">
    <caption class="sr-only">{m.media_episode_ratings_title()}</caption>
    <thead>
      <tr>
        <th scope="col" class="w-8"></th>
        {#each { length: columns } as _, i (i)}
          <th scope="col" class="text-dim w-9 font-mono font-normal"
            >{i + 1}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as season (season.number)}
        <tr>
          <th scope="row" class="text-dim pr-1 text-right font-mono font-normal"
            >{m.media_season_short({ number: season.number })}</th>
          {#each { length: columns } as _, i (i)}
            {@const episode = season.episodes.find((e) => e.number === i + 1)}
            <td class="p-0">
              {#if episode}
                {@const band = ratingBand(episode.voteAverage)}
                {@const label = m.media_episode_ratings_cell({
                  season: season.number,
                  episode: episode.number,
                  rating:
                    episode.voteAverage === null
                      ? m.media_episode_ratings_none()
                      : score(episode.voteAverage),
                })}
                <button
                  type="button"
                  aria-label={episode.myRating === null
                    ? label
                    : `${label}, ${m.media_episode_ratings_mine({ rating: score(episode.myRating) })}`}
                  title={episode.title ?? undefined}
                  onclick={() =>
                    onOpen({ season: season.number, episode: episode.number })}
                  class="relative grid h-7 w-9 place-items-center rounded-md font-mono font-bold transition-transform duration-150 hover:scale-105 motion-reduce:transition-none {band?.cls ??
                    'bg-surface-2 text-dim'}">
                  {episode.voteAverage === null
                    ? "·"
                    : score(episode.voteAverage)}
                  {#if episode.myRating !== null}
                    <span
                      class="bg-fg border-surface absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full border"
                      aria-hidden="true"></span>
                  {/if}
                </button>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<ul class="text-dim mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
  {#each RATING_BANDS as band (band.min)}
    <li class="flex items-center gap-1">
      <span class="h-2.5 w-3.5 rounded-sm {band.cls}" aria-hidden="true"></span>
      {band.label()}
    </li>
  {/each}
  <li class="flex items-center gap-1">
    <span class="bg-fg h-1.5 w-1.5 rounded-full" aria-hidden="true"></span>
    {m.media_episode_ratings_legend_mine()}
  </li>
</ul>
