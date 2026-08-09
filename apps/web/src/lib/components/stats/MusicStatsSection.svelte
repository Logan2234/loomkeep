<script lang="ts">
  // "Musique — en détail" section of /stats. Self-contained: fetches on
  // mount, reuses the MUSIC status breakdown already loaded by the overview
  // for "Écoutés", same pattern as the other domain sections.
  import type {
    DomainStatusBreakdownDto,
    MusicStatsDto,
  } from "@loomkeep/shared";
  import { getMusicStats } from "$lib/api/stats";
  import RankBars from "./RankBars.svelte";
  import StackedBar from "./StackedBar.svelte";
  import { statsResource } from "./stats-resource.svelte";
  import StatTile from "./StatTile.svelte";
  import StatTilesSkeleton from "./StatTilesSkeleton.svelte";

  let {
    musicBreakdown,
  }: { musicBreakdown: DomainStatusBreakdownDto | undefined } = $props();

  const musicStats = statsResource<MusicStatsDto>(
    getMusicStats,
    "Statistiques musique indisponibles",
  );
  const music = $derived(musicStats.data);
  const loading = $derived(musicStats.loading);
  const error = $derived(musicStats.error);

  const listenedCount = $derived(
    musicBreakdown?.byStatus.find((s) => s.bucket === "DONE")?.count ?? 0,
  );

  const hours = $derived(music ? Math.round(music.listenDurationMin / 60) : 0);

  const artistItems = $derived(
    music
      ? music.topArtists.map((a) => ({ label: a.label, value: a.count }))
      : [],
  );

  const TYPE_TINTS = [
    "var(--stat-music)",
    "color-mix(in srgb, var(--stat-music) 60%, var(--surface))",
    "color-mix(in srgb, var(--stat-music) 38%, var(--surface))",
    "color-mix(in srgb, var(--stat-music) 20%, var(--surface))",
  ];
  const typeSegments = $derived(
    music
      ? music.releaseTypeSplit.map((t, i) => ({
          label: t.label,
          color: TYPE_TINTS[i % TYPE_TINTS.length],
          value: t.count,
        }))
      : [],
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if loading}
  <StatTilesSkeleton />
{:else if music}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={hours} unit="h" label="Durée d’écoute" />
    <StatTile value={listenedCount} label="Écoutés" />
    <StatTile value={music.distinctArtistsCount} label="Artistes distincts" />
    <StatTile value={music.totalTracks} label="Titres au total" />
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Artistes les plus représentés
      </h3>
      {#if artistItems.length > 0}
        <RankBars items={artistItems} />
      {:else}
        <p class="text-dim text-sm">Pas encore d’artiste.</p>
      {/if}
    </section>
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">Type de sortie</h3>
      {#if typeSegments.length > 0}
        <StackedBar segments={typeSegments} />
      {:else}
        <p class="text-dim text-sm">Pas encore d’album.</p>
      {/if}
    </section>
  </div>
{/if}
