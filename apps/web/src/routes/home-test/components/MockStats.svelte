<script lang="ts">
  // Mirrors /app/stats: the row of four headline tiles, then a ranked bar
  // list. Both come from the real components used inside the app.
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import StatTile from "$lib/components/stats/StatTile.svelte";
  import { STAT_BARS, STAT_TILES } from "./mock-data";
</script>

<div class="flex flex-col gap-5">
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each STAT_TILES as tile (tile.label)}
      <StatTile
        value={tile.value}
        unit={tile.unit}
        label={tile.label}
        hint={tile.hint} />
    {/each}
  </div>

  <section class="card p-5">
    <h3 class="font-display mb-4 text-lg font-bold">Répartition par domaine</h3>
    <RankBars items={STAT_BARS} />
  </section>
</div>
