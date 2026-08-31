<script lang="ts">
  // "Catalogue & cache": what the on-demand cache holds, how fresh it is and
  // how much of it is actually shared between accounts.
  import RankBars from "$lib/components/stats/RankBars.svelte";
  import {
    STATS_DOMAIN_COLOR_VAR,
    STATS_DOMAIN_LABEL,
  } from "$lib/components/stats/stats-domain";
  import { formatNumber } from "$lib/format";
  import type { AdminCatalogueSectionDto } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";
  import Sparkline from "./Sparkline.svelte";
  import StatFigure from "$lib/components/stats/StatFigure.svelte";

  let { stats }: { stats: AdminCatalogueSectionDto } = $props();

  // Titles can collide across domains ("Dune" the film and the book), so the
  // domain disambiguates the duplicates rather than every row.
  const popularItems = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const w of stats.popular)
      seen.set(w.title, (seen.get(w.title) ?? 0) + 1);
    return stats.popular.map((w) => ({
      label:
        (seen.get(w.title) ?? 0) > 1
          ? `${w.title} (${STATS_DOMAIN_LABEL[w.domain]})`
          : w.title,
      value: w.entries,
    }));
  });
</script>

<div class="grid gap-3.5 lg:grid-cols-2">
  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_catalogue_cache_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_catalogue_cache_desc()}
    </p>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-border text-dim border-b font-mono text-[10px] uppercase">
            <th class="px-2 py-1.5 text-left font-normal"
              >{m.common_domain()}</th>
            <th class="px-2 py-1.5 text-right font-normal"
              >{m.common_items()}</th>
            <th class="px-2 py-1.5 text-right font-normal"
              >{m.admin_catalogue_table_stale()}</th>
            <th class="px-2 py-1.5 text-left font-normal"
              >{m.admin_catalogue_table_trend()}</th>
          </tr>
        </thead>
        <tbody>
          {#each stats.byDomain as row (row.domain)}
            <tr class="border-border border-b last:border-0">
              <td class="px-2 py-2">
                <span
                  class="bg-surface-2 rounded px-1.5 py-0.5 font-mono text-[10px]"
                  style="color:{STATS_DOMAIN_COLOR_VAR[row.domain]}">
                  {STATS_DOMAIN_LABEL[row.domain]}
                </span>
              </td>
              <td class="px-2 py-2 text-right font-mono tabular-nums">
                {formatNumber(row.items)}
              </td>
              <!-- Only MEDIA has a refresh cron; the others have no notion of
                   staleness yet, hence the em dash rather than a fake 0 %. -->
              <td class="px-2 py-2 text-right font-mono tabular-nums">
                {row.stalePercent === null ? "—" : `${row.stalePercent} %`}
              </td>
              <td class="w-24 px-2 py-2">
                <Sparkline
                  points={row.growth}
                  color={STATS_DOMAIN_COLOR_VAR[row.domain]} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-dim mt-2.5 text-[11px] italic">
      {m.admin_catalogue_detail_hint()}
      <a href="/app/admin/cache" class="link-accent not-italic"
        >{m.admin_catalogue_cache_link()}</a
      >.
    </p>
  </div>

  <div class="card p-4">
    <h3 class="font-display text-[15px] font-bold">
      {m.admin_catalogue_popular_title()}
    </h3>
    <p class="text-dim mt-0.5 mb-3.5 text-[11.5px]">
      {m.admin_catalogue_popular_desc()}
    </p>
    <RankBars items={popularItems} />

    <div class="mt-3.5 grid grid-cols-2 gap-3">
      <StatFigure
        value="{stats.sharedPercent} %"
        label={m.admin_catalogue_shared_cache()} />
      <StatFigure
        value={formatNumber(stats.orphanCount)}
        label={m.admin_catalogue_orphans()} />
    </div>
  </div>
</div>
