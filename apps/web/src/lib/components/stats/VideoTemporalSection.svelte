<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // "Activité dans le temps" — video-only for now (EpisodeWatch is the only
  // true per-event log in the app). `period` narrows only the weekday/hour
  // curves; the heatmap and monthly/yearly bars always show their own
  // natural full range (see VideoTemporalDto).
  import type { StatsWindow } from "@loomkeep/shared";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { getVideoTemporal } from "$lib/api/stats";
  import { MONTH_SHORT_OPTIONS, formatDate } from "$lib/format";
  import CalendarHeatmap from "./CalendarHeatmap.svelte";
  import LineChart from "./LineChart.svelte";

  let { period, locked }: { period: StatsWindow; locked: boolean } = $props();

  const temporalStats = createApiQuery(() => ({
    key: keys.stats.videoTemporal(period),
    fetch: () => getVideoTemporal(period),
  }));
  const temporal = $derived(temporalStats.data);
  const error = $derived(temporalStats.error);

  const WEEKDAY_LABEL = Array.from({ length: 7 }, (_, day) =>
    formatDate(new Date(Date.UTC(2026, 7, 30 + day)), {
      weekday: "short",
      timeZone: "UTC",
    }),
  );

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
    label: m.stats_clock_hour({ hour }),
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
        ? temporal.byHour.map((h) => ({
            label: m.stats_clock_hour({ hour: h.hour }),
            value: h.count,
          }))
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
      {m.stats_video_daily_watches()}
    </h3>
    <p class="text-dim mb-4 text-sm">
      {m.stats_video_history_hint()}
    </p>
    <CalendarHeatmap days={heatmapDays} />
    {#if recordDay && recordDay.count > 0}
      <p class="text-dim mt-3 text-xs">
        {m.stats_video_record_day({
          count: recordDay.count,
          date: formatDate(`${recordDay.date}T00:00:00Z`, {
            dateStyle: "medium",
            timeZone: "UTC",
          }),
        })}
      </p>
    {/if}
  </div>

  <div class="mt-5 grid gap-5 md:grid-cols-2">
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        {m.stats_video_weekday()}
      </h3>
      <LineChart points={weekdayPoints} color="var(--stat-media)" />
    </section>
    <section class="card p-5">
      <h3 class="font-display mb-4 text-lg font-bold">
        {m.stats_video_hour()}
      </h3>
      <LineChart points={hourPoints} color="var(--stat-media)" />
    </section>
  </div>

  <section class="card mt-5 p-5">
    <div class="mb-4 flex items-baseline justify-between">
      <h3 class="font-display text-lg font-bold">
        {m.stats_video_monthly_hours()}
      </h3>
      {#if mostActiveYear !== null}
        <span class="text-dim text-xs"
          >{m.stats_video_most_active_year_label()}
          <b class="text-fg">{mostActiveYear}</b></span>
      {/if}
    </div>
    <LineChart points={monthlyPoints} color="var(--stat-media)" />
  </section>
{/if}
