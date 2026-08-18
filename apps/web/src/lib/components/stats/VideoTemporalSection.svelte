<script lang="ts">
  // "Activité dans le temps" — video-only for now (EpisodeWatch is the only
  // true per-event log in the app). `period` narrows only the weekday/hour
  // curves; the heatmap and monthly/yearly bars always show their own
  // natural full range (see VideoTemporalDto).
  import type { StatsWindow, VideoTemporalDto } from "@loomkeep/shared";
  import { getVideoTemporal } from "$lib/api/stats";
  import CalendarHeatmap from "./CalendarHeatmap.svelte";
  import LineChart from "./LineChart.svelte";
  import { statsResource } from "./stats-resource.svelte";

  let { period }: { period: StatsWindow } = $props();

  const temporalStats = statsResource<VideoTemporalDto>(
    () => getVideoTemporal(period),
    "Activité indisponible",
  );
  const temporal = $derived(temporalStats.data);
  const error = $derived(temporalStats.error);

  const WEEKDAY_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const weekdayPoints = $derived(
    temporal
      ? temporal.byWeekday.map((w) => ({
          label: WEEKDAY_LABEL[w.weekday],
          value: w.count,
        }))
      : [],
  );
  const hourPoints = $derived(
    temporal
      ? temporal.byHour.map((h) => ({ label: `${h.hour}h`, value: h.count }))
      : [],
  );

  const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const monthlyPoints = $derived(
    temporal
      ? temporal.monthlyMinutes.map((m) => ({
          label: monthFmt.format(new Date(`${m.month}-01T00:00:00Z`)),
          value: Math.round(m.minutes / 60),
        }))
      : [],
  );

  const recordDay = $derived.by(() => {
    if (!temporal || temporal.heatmap.length === 0) return null;
    return temporal.heatmap.reduce((best, d) =>
      d.count > best.count ? d : best,
    );
  });
</script>

{#if error}
  <p class="text-danger text-sm">{error}</p>
{:else if temporal}
  <div class="card p-5">
    <h3 class="font-display mb-1 text-lg font-bold">
      Épisodes &amp; films vus par jour
    </h3>
    <p class="text-dim mb-4 text-sm">
      Historique réel (import TV Time inclus) — 365 derniers jours.
    </p>
    <CalendarHeatmap days={temporal.heatmap} />
    {#if recordDay && recordDay.count > 0}
      <p class="text-dim mt-3 text-xs">
        Record : {recordDay.count} le {recordDay.date}
      </p>
    {/if}
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        Quand regardes-tu ? (jour)
      </h3>
      <LineChart points={weekdayPoints} color="var(--stat-media)" />
    </section>
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">À quelle heure ?</h3>
      <LineChart points={hourPoints} color="var(--stat-media)" />
    </section>
  </div>

  <section class="card mt-5 p-5">
    <div class="mb-4 flex items-baseline justify-between">
      <h3 class="font-display text-lg font-bold">Heures vues par mois</h3>
      {#if temporal.mostActiveYear !== null}
        <span class="text-dim text-xs"
          >année la plus active : <b class="text-fg"
            >{temporal.mostActiveYear}</b
          ></span>
      {/if}
    </div>
    <LineChart points={monthlyPoints} color="var(--stat-media)" />
  </section>
{/if}
