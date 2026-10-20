<script lang="ts">
  import HistogramBars from "#lib/components/stats/HistogramBars.svelte";
  import KpiStrip from "#lib/components/stats/KpiStrip.svelte";
  import RankBars from "#lib/components/stats/RankBars.svelte";
  import StatFigure from "#lib/components/stats/StatFigure.svelte";
  import TrendChart from "#lib/components/TrendChart.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { foldAdminSearch } from "#lib/admin-search.js";
  let { query = "" }: { query?: string } = $props();
  function matches(name: string) {
    return foldAdminSearch(name).includes(foldAdminSearch(query).trim());
  }
  let empty = $state(false);
  let selected = $state("");
  const rows = [
    { label: m.admin_components_sample_title_one().repeat(3), value: 42 },
    { label: m.admin_components_sample_title_two(), value: 8 },
    { label: m.admin_components_sample_title_three(), value: 0 },
  ];
  const points = [0, 2, 5, 0, 8, 3, 9].map((count, index) => ({
    periodStart: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    count,
  }));
</script>

<div class="space-y-6">
  <button
    class="btn btn-ghost btn-sm"
    aria-pressed={empty}
    onclick={() => {
      empty = !empty;
      selected = "";
    }}
    >{empty
      ? m.admin_components_show_sample()
      : m.admin_components_show_empty()}</button>
  <article
    id="specimen-statfigure"
    hidden={!matches("StatFigure")}
    class="scroll-mt-6">
    <h3 class="mb-3 font-semibold">
      <a href="#specimen-statfigure">StatFigure</a>
    </h3>
    <div class="flex flex-wrap gap-6">
      <StatFigure
        value={empty ? 0 : 1234}
        label={m.common_users()} /><StatFigure
        value={empty ? 0 : 3}
        label={m.common_failure()}
        alert={!empty} />
    </div>
  </article>
  <article
    id="specimen-kpistrip"
    hidden={!matches("KpiStrip")}
    class="scroll-mt-6">
    <h3 class="font-semibold"><a href="#specimen-kpistrip">KpiStrip</a></h3>
    <KpiStrip
      tiles={[
        { value: empty ? "0" : "1 234", label: m.common_users() },
        {
          value: empty ? m.admin_metric_no_sample() : "99.5",
          unit: empty ? undefined : "%",
          label: m.admin_success_rate(),
        },
        { value: empty ? "0" : "3", label: m.common_failure() },
      ]} />
  </article>
  <article
    id="specimen-rankbars"
    hidden={!matches("RankBars")}
    class="scroll-mt-6">
    <h3 class="mb-3 font-semibold">
      <a href="#specimen-rankbars">RankBars</a>
    </h3>
    {#if empty}<EmptyState>{m.admin_no_data()}</EmptyState>{:else}<RankBars
        items={rows} />{/if}
  </article>
  <article
    id="specimen-histogrambars"
    hidden={!matches("HistogramBars")}
    class="scroll-mt-6">
    <h3 class="mb-3 font-semibold">
      <a href="#specimen-histogrambars">HistogramBars</a>
    </h3>
    {#if empty}<EmptyState>{m.admin_no_data()}</EmptyState>{:else}<HistogramBars
        bars={rows.map((row, index) => ({ ...row, label: String(index + 1) }))}
        onSelect={(label) => (selected = label)} />{/if}{#if selected}<p
        class="text-dim mt-2 text-sm"
        role="status">
        {m.common_selected()}: {selected}
      </p>{/if}
  </article>
  <article
    id="specimen-trendchart"
    hidden={!matches("TrendChart")}
    class="scroll-mt-6">
    <h3 class="mb-3 font-semibold">
      <a href="#specimen-trendchart">TrendChart</a>
    </h3>
    {#if empty}<EmptyState>{m.admin_no_data()}</EmptyState>{:else}<TrendChart
        {points}
        period="day" />{/if}
  </article>
</div>
