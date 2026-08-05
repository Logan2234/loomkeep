<script lang="ts">
  // Guard state for sparse opt-in data (possession breakdown today; any
  // future stat below its own data floor can reuse this). Renders instead of
  // a near-empty/misleading chart.
  let {
    renseignedRatio,
    message = "Renseigne le mode de possession de tes œuvres pour activer cette statistique.",
  }: {
    renseignedRatio: number;
    message?: string;
  } = $props();

  const pct = $derived(Math.round(renseignedRatio * 100));
</script>

<div
  class="bg-surface-2 border-border flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center">
  <p class="font-display text-sm font-bold">Pas assez de données</p>
  <p class="text-dim text-xs">
    {message}
    {#if pct > 0}
      ({pct}&nbsp;% renseigné pour l’instant.)
    {/if}
  </p>
</div>
