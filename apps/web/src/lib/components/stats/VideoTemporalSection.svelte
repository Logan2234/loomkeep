<script lang="ts">
  // "Activité dans le temps" — video-only for now (EpisodeWatch is the only
  // true per-event log in the app). `period` narrows only the weekday/hour
  // curves; the heatmap and monthly/yearly bars always show their own
  // natural full range (see VideoTemporalDto).
  import type { StatsWindow, VideoTemporalDto } from "@loomkeep/shared";
  import { getVideoTemporal } from "$lib/api/stats";
  import { MONTH_SHORT_OPTIONS, formatDate } from "$lib/format";
  import CalendarHeatmap from "./CalendarHeatmap.svelte";
  import LineChart from "./LineChart.svelte";
  import { statsResource } from "./stats-resource.svelte";

  let { period, locked }: { period: StatsWindow; locked: boolean } = $props();

  const temporalStats = statsResource<VideoTemporalDto>(() =>
    getVideoTemporal(period),
  );
  const temporal = $derived(temporalStats.data);
  const error = $derived(temporalStats.error);

  const WEEKDAY_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  // Static, made-up preview shown instead of the real (redacted) data when
  // `locked` — see stats.service.ts's redact* methods and PremiumTeaser's
  // own doc comment. A plausible-looking year of activity, not derived
  // from anything real.
  const FAKE_HEATMAP = Array.from({ length: 365 }, (_, i) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (364 - i));
    const seed = (i * 37) % 11;
    return {
      date: day.toISOString().slice(0, 10),
      count: seed < 6 ? 0 : seed < 9 ? 1 : seed < 10 ? 2 : 3,
    };
  });
  const FAKE_WEEKDAY_POINTS = [3, 2, 2, 3, 4, 7, 6].map((value, weekday) => ({
    label: WEEKDAY_LABEL[weekday],
    value,
  }));
  const FAKE_HOUR_POINTS = Array.from({ length: 24 }, (_, hour) => ({
    label: `${hour}h`,
    value: hour >= 19 && hour <= 22 ? 8 : hour >= 12 && hour <= 14 ? 4 : 1,
  }));
  const FAKE_MONTHLY_POINTS = [8, 10, 6, 9, 12, 7, 5, 6, 11, 14, 9, 8].map(
    (value, i) => ({
      label: formatDate(
        `2026-${String(((i + new Date().getMonth() + 1) % 12) + 1).padStart(2, "0")}-01T00:00:00Z`,
        MONTH_SHORT_OPTIONS,
      ),
      value,
    }),
  );

  const weekdayPoints = $derived(
    locked
      ? FAKE_WEEKDAY_POINTS
      : temporal
        ? temporal.byWeekday.map((w) => ({
            label: WEEKDAY_LABEL[w.weekday],
            value: w.count,
          }))
        : [],
  );
  const hourPoints = $derived(
    locked
      ? FAKE_HOUR_POINTS
      : temporal
        ? temporal.byHour.map((h) => ({ label: `${h.hour}h`, value: h.count }))
        : [],
  );

  const monthlyPoints = $derived(
    locked
      ? FAKE_MONTHLY_POINTS
      : temporal
        ? temporal.monthlyMinutes.map((m) => ({
            label: formatDate(`${m.month}-01T00:00:00Z`, MONTH_SHORT_OPTIONS),
            value: Math.round(m.minutes / 60),
          }))
        : [],
  );

  const heatmapDays = $derived(
    locked ? FAKE_HEATMAP : (temporal?.heatmap ?? []),
  );

  const recordDay = $derived.by(() => {
    if (heatmapDays.length === 0) return null;
    return heatmapDays.reduce((best, d) => (d.count > best.count ? d : best));
  });

  const mostActiveYear = $derived(
    locked ? new Date().getFullYear() : (temporal?.mostActiveYear ?? null),
  );
</script>

{#if error && !locked}
  <p class="text-danger text-sm">{error}</p>
{:else if locked || temporal}
  <div class="card p-5">
    <h3 class="font-display mb-1 text-lg font-bold">
      Épisodes &amp; films vus par jour
    </h3>
    <p class="text-dim mb-4 text-sm">
      Historique réel (import TV Time inclus) — 365 derniers jours.
    </p>
    <CalendarHeatmap days={heatmapDays} />
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
      {#if mostActiveYear !== null}
        <span class="text-dim text-xs"
          >année la plus active : <b class="text-fg">{mostActiveYear}</b></span>
      {/if}
    </div>
    <LineChart points={monthlyPoints} color="var(--stat-media)" />
  </section>
{/if}
