<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { getMusicStats } from "#lib/api/stats.js";
  import type { DomainStatusBreakdownDto } from "@loomkeep/shared";
  import PremiumTeaser from "../PremiumTeaser.svelte";
  import RankBars from "./RankBars.svelte";
  import StackedBar from "./StackedBar.svelte";
  import StatTile from "./StatTile.svelte";

  let {
    musicBreakdown,
    locked,
  }: {
    musicBreakdown: DomainStatusBreakdownDto | undefined;
    locked: boolean;
  } = $props();

  const musicStats = createApiQuery(() => ({
    key: keys.stats.music(),
    fetch: getMusicStats,
  }));
  const music = $derived(musicStats.data);
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
    (music ? music.releaseTypeSplit : []).map((t, i) => ({
      label: t.label,
      color: TYPE_TINTS[i % TYPE_TINTS.length],
      value: t.count,
    })),
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if music}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile
      value={hours}
      unit={m.common_hours_short()}
      label={m.stats_music_duration()} />
    <StatTile value={listenedCount} label={m.stats_music_listened()} />
    <StatTile
      value={music.distinctArtistsCount}
      label={m.stats_music_distinct_artists()} />
    <StatTile value={music.totalTracks} label={m.stats_music_total_tracks()} />
  </div>

  <PremiumTeaser {locked} class="mt-5 block">
    <div class="grid gap-5 md:grid-cols-2">
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.stats_music_top_artists()}
        </h3>
        <div class="panel-body">
          {#if artistItems.length > 0}
            <RankBars items={artistItems} />
          {:else}
            <p class="text-dim text-sm">{m.stats_music_no_artists()}</p>
          {/if}
        </div>
      </section>
      <section class="panel md:p-5">
        <h3 class="panel-head font-display text-lg font-bold md:mb-4">
          {m.music_release_type()}
        </h3>
        <div class="panel-body">
          {#if typeSegments.length > 0}
            <StackedBar segments={typeSegments} />
          {:else}
            <p class="text-dim text-sm">{m.stats_music_no_albums()}</p>
          {/if}
        </div>
      </section>
    </div>
  </PremiumTeaser>
{/if}
