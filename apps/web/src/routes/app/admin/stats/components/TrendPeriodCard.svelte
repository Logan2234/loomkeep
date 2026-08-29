<script
  lang="ts"
  generics="T extends { period: TrendPeriod; points: TrendPointDto[] }">
  // A curve card owning its own bucket-size picker: /admin/stats has no global
  // period selector, so each temporal card re-queries its own endpoint. The
  // payload carries the default (weekly) curve; picking another period
  // overrides it locally, and remounting the section drops the override.
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import TrendChart from "$lib/components/TrendChart.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { TrendPeriod, TrendPointDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";

  let {
    title,
    description = "",
    initial,
    load,
    footer,
  }: {
    title: string;
    /** Sentence prefixed to the cadence line; the cadence alone when empty. */
    description?: string;
    initial: T;
    load: (period: TrendPeriod) => Promise<T>;
    /** The figures under the curve — they read fields only the caller knows. */
    footer: Snippet<[T]>;
  } = $props();

  const PERIODS: { value: TrendPeriod; label: string }[] = [
    { value: "day", label: m.common_day() },
    { value: "week", label: m.common_week() },
    { value: "month", label: m.common_month() },
    { value: "year", label: m.common_year() },
  ];
  const CADENCE: Record<TrendPeriod, string> = {
    day: m.admin_trend_cadence_day(),
    week: m.admin_trend_cadence_week(),
    month: m.admin_trend_cadence_month(),
    year: m.admin_trend_cadence_year(),
  };

  const periodMut = createApiMutation(() => ({
    mutate: (period: TrendPeriod) => load(period),
  }));

  const trend = $derived(periodMut.data ?? initial);

  function setPeriod(period: TrendPeriod) {
    if (period === trend.period || periodMut.loading) return;
    periodMut.mutate(period);
  }
</script>

<div class="card p-4">
  <div class="mb-3.5 flex flex-wrap items-start justify-between gap-2">
    <div>
      <h3 class="font-display text-[15px] font-bold">{title}</h3>
      <p class="text-dim mt-0.5 text-[11.5px]">
        {#if description}{description}
        {/if}{CADENCE[trend.period]}
      </p>
    </div>
    <div class="flex gap-1">
      {#each PERIODS as p (p.value)}
        <button
          class="chip !px-2.5 !py-1 !text-xs"
          class:chip-on={trend.period === p.value}
          disabled={periodMut.loading}
          onclick={() => setPeriod(p.value)}>
          {p.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="transition-opacity" class:opacity-50={periodMut.loading}>
    <TrendChart points={trend.points} period={trend.period} />
  </div>
  {@render footer(trend)}
  {#if periodMut.error}
    <p class="text-danger mt-1.5 text-xs">{periodMut.error}</p>
  {/if}
</div>
