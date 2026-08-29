<script lang="ts">
  // "Musique — en détail" section of /stats. Self-contained: fetches on
  // mount, reuses the MUSIC status breakdown already loaded by the overview
  // for "Écoutés", same pattern as the other domain sections.
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getMusicStats } from "$lib/api/stats";
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

  // Static, made-up previews shown instead of the real (redacted) advanced
  // fields when `locked` — see stats.service.ts's redact* methods and
  // PremiumTeaser's own doc comment.
  const FAKE_ARTISTS = [
    { label: "Un artiste favori", value: 12 },
    { label: "Un autre artiste", value: 8 },
    { label: "Découverte récente", value: 3 },
  ];
  const FAKE_TYPE_SPLIT = [
    { label: "Album", count: 14 },
    { label: "EP", count: 5 },
    { label: "Single", count: 3 },
  ];

  const artistItems = $derived(
    locked
      ? FAKE_ARTISTS
      : music
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
    (locked ? FAKE_TYPE_SPLIT : music ? music.releaseTypeSplit : []).map(
      (t, i) => ({
        label: t.label,
        color: TYPE_TINTS[i % TYPE_TINTS.length],
        value: t.count,
      }),
    ),
  );
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if music}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile value={hours} unit="h" label="Durée d'écoute" />
    <StatTile value={listenedCount} label="Écoutés" />
    <StatTile value={music.distinctArtistsCount} label="Artistes distincts" />
    <StatTile value={music.totalTracks} label="Titres au total" />
  </div>

  <PremiumTeaser {locked} class="mt-5 block">
    <div class="grid gap-5 md:grid-cols-2">
      <section class="card p-5">
        <h3 class="font-display mb-4 text-lg font-bold">
          Artistes les plus représentés
        </h3>
        {#if locked || artistItems.length > 0}
          <RankBars items={artistItems} />
        {:else}
          <p class="text-dim text-sm">Pas encore d'artiste.</p>
        {/if}
      </section>
      <section class="card p-5">
        <h3 class="font-display mb-4 text-lg font-bold">Type de sortie</h3>
        {#if locked || typeSegments.length > 0}
          <StackedBar segments={typeSegments} />
        {:else}
          <p class="text-dim text-sm">Pas encore d'album.</p>
        {/if}
      </section>
    </div>
  </PremiumTeaser>
{/if}
