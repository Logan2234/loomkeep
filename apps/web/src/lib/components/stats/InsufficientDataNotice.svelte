<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  // Guard state for sparse opt-in data (possession breakdown today; any
  // future stat below its own data floor can reuse this). Renders instead of
  // a near-empty/misleading chart.
  let {
    renseignedRatio,
    message = m.stats_ownership_required(),
  }: {
    renseignedRatio: number;
    message?: string;
  } = $props();

  const pct = $derived(Math.round(renseignedRatio * 100));
</script>

<div
  class="bg-surface-2 border-border flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center">
  <p class="font-display text-sm font-bold">{m.stats_insufficient_data()}</p>
  <p class="text-dim text-xs">
    {message}
    {#if pct > 0}
      {m.stats_supplied_percent({ percent: pct })}
    {/if}
  </p>
</div>
